'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  ChevronDown,
  Loader2,
  CheckCircle,
  ImagePlus,
  X,
  Wallet,
  Plus,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFactory } from '@/hooks/useContracts';
import { MANTLE_SEPOLIA } from '@/lib/contracts';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import PageTransition from '@/components/ui/page-transition';

interface FormData {
  title: string;
  description: string;
  category: string;
  endDateTime: Date | undefined;
  resolutionSource: string;
  image: string;
  options: string[];
}

interface FormErrors {
  title?: string;
  description?: string;
  category?: string;
  endDateTime?: string;
  image?: string;
  options?: string;
}

const STEPS = [
  { id: 1, title: 'Question' },
  { id: 2, title: 'Options' },
  { id: 3, title: 'Resolution' },
  { id: 4, title: 'Details' },
  { id: 5, title: 'Review' },
];

export default function CreateMarketPage() {
  const router = useRouter();
  const { authenticated, login, user } = usePrivy();
  const { createMarket, isLoading: isContractLoading, error: contractError } = useFactory();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'deploying' | 'saving' | 'done'>('idle');
  const [marketAddress, setMarketAddress] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [currentUTCTime, setCurrentUTCTime] = useState<string>('');

  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    category: '',
    endDateTime: undefined,
    resolutionSource: '',
    image: '',
    options: ['', ''],
  });
  const [imagePreview, setImagePreview] = useState<string>('');
  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/category');
        const data = await response.json();
        if (data.success) {
          setCategories(data.categories);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setIsLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  // Live UTC time clock
  useEffect(() => {
    const formatUTCTime = () => {
      const now = new Date();
      return now.toLocaleString('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }) + ' UTC';
    };

    setCurrentUTCTime(formatUTCTime());
    const interval = setInterval(() => {
      setCurrentUTCTime(formatUTCTime());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const validateStep = (step: number): boolean => {
    const newErrors: FormErrors = {};

    switch (step) {
      case 1: // Question & Image
        if (!formData.title.trim()) {
          newErrors.title = 'Question is required';
        } else if (formData.title.length < 10) {
          newErrors.title = 'Question must be at least 10 characters';
        }
        if (!formData.image) {
          newErrors.image = 'Please upload an image for your market';
        }
        break;

      case 2: // Options
        if (formData.options.length < 2 || formData.options.length > 4) {
          newErrors.options = 'Must have 2-4 options';
        } else {
          const trimmedOptions = formData.options.map(o => o.trim());
          const hasEmpty = trimmedOptions.some(o => o.length === 0);
          const nonEmptyOptions = trimmedOptions.filter(o => o.length > 0);
          const hasDuplicates = new Set(nonEmptyOptions.map(o => o.toLowerCase())).size !== nonEmptyOptions.length;

          if (hasEmpty) {
            newErrors.options = 'All options must have labels';
          } else if (hasDuplicates) {
            newErrors.options = 'Option labels must be unique';
          }
        }
        break;

      case 3: // Resolution
        if (!formData.description.trim()) {
          newErrors.description = 'Resolution criteria is required';
        } else if (formData.description.length < 20) {
          newErrors.description = 'Resolution criteria must be at least 20 characters';
        }
        break;

      case 4: // Category & Timing
        if (!formData.category) {
          newErrors.category = 'Please select a category';
        }
        if (!formData.endDateTime) {
          newErrors.endDateTime = 'End date and time is required';
        } else {
          const now = new Date();
          if (formData.endDateTime <= now) {
            newErrors.endDateTime = 'End date/time must be in the future';
          }
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const goToStep = (step: number) => {
    // Only allow going to previous steps or current step
    if (step <= currentStep) {
      setCurrentStep(step);
    }
  };

  const handleSubmit = async () => {
    if (!authenticated) {
      login();
      return;
    }

    if (!user?.wallet?.address) {
      return;
    }

    setIsSubmitting(true);
    setTxStatus('deploying');

    try {
      if (!formData.endDateTime) {
        throw new Error('End date/time is required');
      }

      const trimmedOptions = formData.options.map(o => o.trim());
      const newMarketAddress = await createMarket(formData.title, formData.endDateTime, trimmedOptions);

      if (!newMarketAddress) {
        throw new Error('Failed to get market address from transaction');
      }

      setMarketAddress(newMarketAddress);
      setTxStatus('saving');

      const response = await fetch('/api/poll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creatorWalletAddress: user.wallet.address,
          question: formData.title,
          category: formData.category,
          resolutionCriteria: formData.description,
          resolutionSource: formData.resolutionSource || undefined,
          pollEnd: formData.endDateTime.toISOString(),
          image: formData.image,
          contractAddress: newMarketAddress,
          options: trimmedOptions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save market metadata');
      }

      setTxStatus('done');
      setIsSuccess(true);

      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (error) {
      console.error('Error creating market:', error);
      setTxStatus('idle');
      alert(error instanceof Error ? error.message : 'Failed to create market');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleCategorySelect = (category: string) => {
    if (category === '__create_new__') {
      setIsCreatingNewCategory(true);
      setCategoryOpen(false);
      return;
    }
    setFormData((prev) => ({ ...prev, category }));
    setIsCreatingNewCategory(false);
    setNewCategoryName('');
    setCategoryOpen(false);
    if (errors.category) {
      setErrors((prev) => ({ ...prev, category: undefined }));
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      return;
    }

    try {
      const response = await fetch('/api/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          createdBy: user?.wallet?.address,
        }),
      });

      const data = await response.json();
      if (data.success) {
        if (!categories.includes(data.category)) {
          setCategories((prev) => [...prev, data.category].sort());
        }
        setFormData((prev) => ({ ...prev, category: data.category }));
        setIsCreatingNewCategory(false);
        setNewCategoryName('');
        if (errors.category) {
          setErrors((prev) => ({ ...prev, category: undefined }));
        }
      }
    } catch (error) {
      console.error('Error creating category:', error);
    }
  };

  const cancelNewCategory = () => {
    setIsCreatingNewCategory(false);
    setNewCategoryName('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, image: 'Please upload a valid image file' }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, image: 'Image must be less than 5MB' }));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setFormData((prev) => ({ ...prev, image: base64String }));
      setImagePreview(base64String);
      if (errors.image) {
        setErrors((prev) => ({ ...prev, image: undefined }));
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setFormData((prev) => ({ ...prev, image: '' }));
    setImagePreview('');
  };

  // Success screen
  if (isSuccess) {
    return (
      <PageTransition className="min-h-[80vh] flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6 animate-pulse">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Market Created!</h1>
          <p className="text-muted-foreground mb-6">Your prediction market is now live on Mantle Sepolia.</p>
          {marketAddress && (
            <div className="mb-6 p-4 rounded-xl bg-card border border-border">
              <p className="text-muted-foreground text-xs mb-2">Contract Address</p>
              <a
                href={`${MANTLE_SEPOLIA.blockExplorer}/address/${marketAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 text-sm font-mono break-all"
              >
                {marketAddress}
              </a>
            </div>
          )}
          <p className="text-muted-foreground text-sm animate-pulse">Redirecting to home...</p>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => currentStep === 1 ? router.push('/') : handleBack()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">
            {currentStep === 1 ? 'Back to Markets' : 'Previous Step'}
          </span>
        </button>
      </div>

      {/* Step Indicators */}
      <div className="flex justify-center mb-6 sm:mb-10 overflow-x-auto overflow-y-hidden">
        <div className="flex items-center gap-1.5 sm:gap-3">
          {STEPS.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            const isClickable = step.id <= currentStep;

            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => goToStep(step.id)}
                  disabled={!isClickable}
                  className={cn(
                    'w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-all duration-200',
                    isActive && 'bg-primary text-primary-foreground scale-110',
                    isCompleted && 'bg-green-500 text-white',
                    !isActive && !isCompleted && 'bg-muted text-muted-foreground',
                    isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  ) : (
                    step.id
                  )}
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'w-4 sm:w-8 h-0.5 ml-1.5 sm:ml-3',
                      step.id < currentStep ? 'bg-green-500' : 'bg-border'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-[350px] sm:min-h-[400px]">
        {/* Step 1: Question & Image */}
        {currentStep === 1 && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">What's your prediction?</h2>
            </div>

            {/* Question Input */}
            <div className="rounded-xl sm:rounded-2xl border border-border bg-card/40 backdrop-blur-xl p-4 sm:p-6">
              <label className="block text-sm font-medium text-foreground mb-3">
                Market Question
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Will Bitcoin reach $200,000 by the end of 2025?"
                className={cn(
                  'w-full bg-muted border rounded-xl px-4 py-4 text-lg text-foreground placeholder-muted-foreground focus:outline-none transition-colors',
                  errors.title
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-border focus:border-primary'
                )}
              />
              {errors.title && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.title}
                </p>
              )}
              <p className="mt-3 text-sm text-muted-foreground">
                Ask a clear question about a future event.
              </p>
            </div>

            {/* Image Upload */}
            <div className="rounded-xl sm:rounded-2xl border border-border bg-card/40 backdrop-blur-xl p-4 sm:p-6">
              <label className="block text-sm font-medium text-foreground mb-3">
                Market Image
              </label>

              {imagePreview ? (
                <div className="relative group">
                  <img
                    src={imagePreview}
                    alt="Market preview"
                    className="w-full h-56 object-cover rounded-xl border border-border"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    title="Remove image"
                    className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              ) : (
                <label
                  className={cn(
                    'flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:scale-[1.01]',
                    errors.image
                      ? 'border-red-500 bg-red-500/5'
                      : 'border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/50'
                  )}
                >
                  <div className="flex flex-col items-center justify-center py-6">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <ImagePlus className="h-8 w-8 text-primary" />
                    </div>
                    <p className="text-base text-foreground font-medium mb-1">
                      Click to upload an image
                    </p>
                    <p className="text-sm text-muted-foreground">
                      PNG, JPG, GIF up to 5MB
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}

              {errors.image && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.image}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Options */}
        {currentStep === 2 && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Define the outcomes</h2>
              <p className="text-muted-foreground text-sm sm:text-base">
                Create 2-4 possible outcomes for your prediction market.
              </p>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-border bg-card/40 backdrop-blur-xl p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <label className="block text-sm font-medium text-foreground">
                  Market Options
                </label>
                <span className="text-sm text-muted-foreground px-3 py-1 rounded-full bg-muted">
                  {formData.options.length}/4 options
                </span>
              </div>

              <div className="space-y-4">
                {formData.options.map((option, index) => (
                  <div key={index} className="flex gap-3 items-center">
                    <div className="flex-shrink-0 w-10 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-semibold">{index + 1}</span>
                    </div>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...formData.options];
                        newOptions[index] = e.target.value;
                        setFormData(prev => ({ ...prev, options: newOptions }));
                        if (errors.options) {
                          setErrors(prev => ({ ...prev, options: undefined }));
                        }
                      }}
                      placeholder={`Option ${index + 1} (e.g., ${index === 0 ? 'Yes' : index === 1 ? 'No' : 'Maybe'})`}
                      className={cn(
                        'flex-1 bg-muted border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none transition-colors',
                        errors.options
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-border focus:border-primary'
                      )}
                    />
                    {formData.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newOptions = formData.options.filter((_, i) => i !== index);
                          setFormData(prev => ({ ...prev, options: newOptions }));
                        }}
                        className="p-3 rounded-lg bg-muted border border-border text-muted-foreground hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {formData.options.length < 4 && (
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      options: [...prev.options, '']
                    }));
                  }}
                  className="mt-4 w-full py-3 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Add Another Option
                </button>
              )}

              {errors.options && (
                <p className="mt-4 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.options}
                </p>
              )}

              <p className="mt-4 text-sm text-muted-foreground">
                Multiple options can win when resolved. Users will bet on their predicted outcomes.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Resolution */}
        {currentStep === 3 && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">How will it be resolved?</h2>
              <p className="text-muted-foreground text-sm sm:text-base">
                Define clear criteria for determining the outcome.
              </p>
            </div>

            {/* Resolution Criteria */}
            <div className="rounded-xl sm:rounded-2xl border border-border bg-card/40 backdrop-blur-xl p-4 sm:p-6">
              <label className="block text-sm font-medium text-foreground mb-3">
                Resolution Criteria
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={5}
                placeholder="This market resolves to YES if Bitcoin (BTC) reaches or exceeds $200,000 USD on any major exchange (Coinbase, Binance, Kraken) before December 31, 2025 11:59 PM ET. The price must be sustained for at least 1 minute."
                className={cn(
                  'w-full bg-muted border rounded-xl px-4 py-4 text-foreground placeholder-muted-foreground focus:outline-none transition-colors resize-none',
                  errors.description
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-border focus:border-primary'
                )}
              />
              {errors.description && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.description}
                </p>
              )}
              <p className="mt-3 text-sm text-muted-foreground">
                Be specific about sources, conditions, and edge cases.
              </p>
            </div>

            {/* Resolution Source (Optional) */}
            <div className="rounded-xl sm:rounded-2xl border border-border bg-card/40 backdrop-blur-xl p-4 sm:p-6">
              <label className="block text-sm font-medium text-foreground mb-3">
                Resolution Source <span className="text-muted-foreground font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                name="resolutionSource"
                value={formData.resolutionSource}
                onChange={handleInputChange}
                placeholder="e.g., https://coinmarketcap.com, Official announcement, etc."
                className="w-full bg-muted border border-border rounded-xl px-4 py-4 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                Specify the official source that will be used to determine the outcome.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Category & Timing */}
        {currentStep === 4 && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Final details</h2>
              <p className="text-muted-foreground text-sm sm:text-base">
                Choose a category and set when betting closes.
              </p>
            </div>

            {/* Category */}
            <div className={cn(
              "rounded-xl sm:rounded-2xl border border-border bg-card/40 backdrop-blur-xl p-4 sm:p-6 relative",
              categoryOpen && "z-50"
            )}>
              <label className="block text-sm font-medium text-foreground mb-3">
                Category
              </label>

              {isCreatingNewCategory ? (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Enter new category name"
                    className="w-full bg-muted border border-border rounded-xl px-4 py-4 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateCategory();
                      } else if (e.key === 'Escape') {
                        cancelNewCategory();
                      }
                    }}
                  />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      disabled={!newCategoryName.trim()}
                      className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Create Category
                    </button>
                    <button
                      type="button"
                      onClick={cancelNewCategory}
                      className="px-6 py-3 rounded-xl bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCategoryOpen(!categoryOpen)}
                    disabled={isLoadingCategories}
                    className={cn(
                      'w-full bg-muted border rounded-xl px-4 py-4 text-left flex items-center justify-between transition-colors',
                      errors.category
                        ? 'border-red-500'
                        : 'border-border hover:border-primary',
                      formData.category ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {isLoadingCategories ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading categories...
                      </span>
                    ) : (
                      formData.category || 'Select a category'
                    )}
                    <ChevronDown
                      className={cn(
                        'h-5 w-5 text-muted-foreground transition-transform',
                        categoryOpen && 'rotate-180'
                      )}
                    />
                  </button>

                  {categoryOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl max-h-60 overflow-y-auto z-50 shadow-xl">
                      <button
                        type="button"
                        onClick={() => handleCategorySelect('__create_new__')}
                        className="w-full px-4 py-3 text-left text-sm transition-colors text-primary hover:bg-primary/10 border-b border-border flex items-center gap-2 font-medium"
                      >
                        <Plus className="h-4 w-4" />
                        Create new category
                      </button>

                      {categories.length === 0 ? (
                        <div className="px-4 py-4 text-sm text-muted-foreground text-center">
                          No categories yet. Create one!
                        </div>
                      ) : (
                        categories.map((category) => (
                          <button
                            key={category}
                            type="button"
                            onClick={() => handleCategorySelect(category)}
                            className={cn(
                              'w-full px-4 py-3 text-left text-sm transition-colors',
                              formData.category === category
                                ? 'bg-primary/10 text-foreground font-medium'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                          >
                            {category}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {errors.category && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.category}
                </p>
              )}
            </div>

            {/* End Date & Time */}
            <div className="rounded-xl sm:rounded-2xl border border-border bg-card/40 backdrop-blur-xl p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-foreground">
                  End Date & Time
                </label>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">UTC:</span>
                  <span className="text-xs font-mono text-foreground">{currentUTCTime}</span>
                </div>
              </div>

              <DateTimePicker
                date={formData.endDateTime}
                setDate={(date) => {
                  setFormData((prev) => ({ ...prev, endDateTime: date }));
                  if (errors.endDateTime) {
                    setErrors((prev) => ({ ...prev, endDateTime: undefined }));
                  }
                }}
                minDate={new Date()}
                placeholder="Select end date and time"
                error={!!errors.endDateTime}
              />
              {errors.endDateTime && (
                <p className="mt-3 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.endDateTime}
                </p>
              )}
              <p className="mt-4 text-sm text-muted-foreground">
                Set when betting closes. The market can be resolved after this time.
              </p>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {currentStep === 5 && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Review your market</h2>
              <p className="text-muted-foreground text-sm sm:text-base">
                Confirm all details before creating your prediction market.
              </p>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-primary/30 bg-card/60 backdrop-blur-xl overflow-hidden">
              {/* Image Preview */}
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Market preview"
                  className="w-full h-48 object-cover"
                />
              )}

              <div className="p-6 space-y-6">
                {/* Question */}
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
                    Question
                  </label>
                  <p className="text-xl font-semibold text-foreground">{formData.title}</p>
                </div>

                {/* Options */}
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                    Outcomes
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {formData.options.filter(o => o.trim()).map((opt, i) => (
                      <span
                        key={i}
                        className="px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-foreground font-medium"
                      >
                        {opt.trim()}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Resolution */}
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
                    Resolution Criteria
                  </label>
                  <p className="text-foreground">{formData.description}</p>
                  {formData.resolutionSource && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Source: {formData.resolutionSource}
                    </p>
                  )}
                </div>

                {/* Category & End Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-4 border-t border-border">
                  <div>
                    <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
                      Category
                    </label>
                    <p className="text-foreground font-medium">{formData.category}</p>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
                      Betting Ends
                    </label>
                    <p className="text-foreground font-medium">
                      {formData.endDateTime?.toLocaleString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Wallet Warning */}
            {!authenticated && (
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0" />
                <p className="text-sm text-foreground">
                  Please connect your wallet to create a market.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-4 mt-8">
        {currentStep > 1 && (
          <button
            type="button"
            onClick={handleBack}
            className="flex-1 py-4 rounded-xl font-semibold border border-border text-foreground hover:bg-muted transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
        )}

        {currentStep < STEPS.length ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 py-4 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all flex items-center justify-center gap-2"
          >
            Continue
            <ArrowRight className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !authenticated}
            className="flex-1 py-4 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {txStatus === 'deploying' && 'Deploying to Mantle...'}
                {txStatus === 'saving' && 'Saving metadata...'}
                {txStatus === 'done' && 'Market created!'}
              </>
            ) : authenticated ? (
              <>
                <Wallet className="h-5 w-5" />
                Create Market on Mantle
              </>
            ) : (
              'Connect Wallet to Create'
            )}
          </button>
        )}
      </div>

      {/* Footer Note */}
      <p className="text-center text-xs text-muted-foreground mt-6">
        By creating a market, you agree to provide accurate resolution based on the criteria defined.
      </p>
    </PageTransition>
  );
}
