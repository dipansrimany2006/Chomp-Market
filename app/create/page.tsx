'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import {
  ArrowLeft,
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

interface FormData {
  title: string;
  description: string;
  category: string;
  endDateTime: Date | undefined; // Date object for calendar picker
  resolutionSource: string;
  image: string;
  options: string[]; // Custom options (2-4)
}

interface FormErrors {
  title?: string;
  description?: string;
  category?: string;
  endDateTime?: string;
  image?: string;
  options?: string;
}

export default function CreateMarketPage() {
  const router = useRouter();
  const { authenticated, login, user } = usePrivy();
  const { createMarket, isLoading: isContractLoading, error: contractError } = useFactory();
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
    options: ['', ''], // Start with 2 empty options
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

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Question is required';
    } else if (formData.title.length < 10) {
      newErrors.title = 'Question must be at least 10 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Resolution criteria is required';
    } else if (formData.description.length < 20) {
      newErrors.description = 'Resolution criteria must be at least 20 characters';
    }

    if (!formData.category) {
      newErrors.category = 'Please select a category';
    }

    if (!formData.endDateTime) {
      newErrors.endDateTime = 'End date and time is required';
    } else {
      // Compare with current time
      const now = new Date();
      if (formData.endDateTime <= now) {
        newErrors.endDateTime = 'End date/time must be in the future';
      }
    }

    if (!formData.image) {
      newErrors.image = 'Please upload an image for your market';
    }

    // Options validation
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!authenticated) {
      login();
      return;
    }

    if (!validateForm()) {
      return;
    }

    if (!user?.wallet?.address) {
      return;
    }

    setIsSubmitting(true);
    setTxStatus('deploying');

    try {
      // Step 1: Deploy market on-chain
      if (!formData.endDateTime) {
        throw new Error('End date/time is required');
      }

      // Trim options before sending
      const trimmedOptions = formData.options.map(o => o.trim());

      const newMarketAddress = await createMarket(formData.title, formData.endDateTime, trimmedOptions);

      if (!newMarketAddress) {
        throw new Error('Failed to get market address from transaction');
      }

      setMarketAddress(newMarketAddress);
      setTxStatus('saving');

      // Step 2: Save metadata to MongoDB
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
          contractAddress: newMarketAddress, // Link to on-chain market
          options: trimmedOptions, // Custom options
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save market metadata');
      }

      setTxStatus('done');
      setIsSuccess(true);

      // Redirect after success
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
    // Clear error when user starts typing
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
        // Add to categories list if not already there
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

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, image: 'Please upload a valid image file' }));
      return;
    }

    // Validate file size (max 5MB)
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

  if (isSuccess) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Market Created!</h1>
          <p className="text-muted-foreground mb-4">Your prediction market is now live on Mantle Sepolia.</p>
          {marketAddress && (
            <div className="mb-6">
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
          <p className="text-muted-foreground text-sm">Redirecting to home...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[80%] max-w-3xl flex flex-col py-6">
        {/* Header Navigation */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back to Markets</span>
          </button>
        </div>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Create a Market</h1>
          <p className="text-muted-foreground">
            Create a prediction market and let the crowd forecast the outcome.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Question Input */}
          <div className="rounded-2xl border border-border bg-card/40 backdrop-blur-xl p-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              Question <span className="text-muted-foreground">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Will Bitcoin reach $200,000 by the end of 2025?"
              className={cn(
                'w-full bg-muted border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none transition-colors',
                errors.title
                  ? 'border-primary focus:border-primary'
                  : 'border-border focus:border-primary/40'
              )}
            />
            {errors.title && (
              <p className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.title}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Ask a clear yes/no question about a future event.
            </p>
          </div>

          {/* Image Upload */}
          <div className="rounded-2xl border border-border bg-card/40 backdrop-blur-xl p-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              Market Image <span className="text-muted-foreground">*</span>
            </label>

            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Market preview"
                  className="w-full h-48 object-cover rounded-xl border border-border"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  title="Remove image"
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-card/70 hover:bg-card/90 transition-colors"
                >
                  <X className="h-4 w-4 text-foreground" />
                </button>
              </div>
            ) : (
              <label
                className={cn(
                  'flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-colors',
                  errors.image
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-muted/30 hover:bg-muted/50 hover:border-border'
                )}
              >
                <div className="flex flex-col items-center justify-center py-6">
                  <ImagePlus className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">
                    Click to upload an image
                  </p>
                  <p className="text-xs text-muted-foreground">
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
              <p className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.image}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Upload an image that represents your market question.
            </p>
          </div>

          {/* Custom Options */}
          <div className="rounded-2xl border border-border bg-card/40 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-foreground">
                Market Options <span className="text-muted-foreground">*</span>
              </label>
              <span className="text-xs text-muted-foreground">
                {formData.options.length}/4 options
              </span>
            </div>

            <div className="space-y-3">
              {formData.options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-shrink-0 w-8 h-11 rounded-lg bg-muted flex items-center justify-center">
                    <span className="text-muted-foreground text-sm font-medium">{index + 1}</span>
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
                    placeholder={`Option ${index + 1}`}
                    className={cn(
                      'flex-1 bg-muted border rounded-xl px-4 py-2.5 text-foreground placeholder-muted-foreground focus:outline-none transition-colors',
                      errors.options
                        ? 'border-primary focus:border-primary'
                        : 'border-border focus:border-primary/40'
                    )}
                  />
                  {/* Remove button (only show if more than 2 options) */}
                  {formData.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newOptions = formData.options.filter((_, i) => i !== index);
                        setFormData(prev => ({ ...prev, options: newOptions }));
                      }}
                      className="p-2.5 rounded-lg bg-muted border border-border text-muted-foreground hover:bg-muted/80 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add Option Button */}
            {formData.options.length < 4 && (
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    options: [...prev.options, '']
                  }));
                }}
                className="mt-3 w-full py-2.5 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Option
              </button>
            )}

            {errors.options && (
              <p className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.options}
              </p>
            )}

            <p className="mt-2 text-xs text-muted-foreground">
              Define 2-4 custom outcomes for your market. Multiple options can win when resolved.
            </p>
          </div>

          {/* Resolution Criteria */}
          <div className="rounded-2xl border border-border bg-card/40 backdrop-blur-xl p-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              Resolution Criteria <span className="text-muted-foreground">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              placeholder="This market resolves to YES if Bitcoin (BTC) reaches or exceeds $200,000 USD on any major exchange (Coinbase, Binance, Kraken) before December 31, 2025 11:59 PM ET. The price must be sustained for at least 1 minute."
              className={cn(
                'w-full bg-muted border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none transition-colors resize-none',
                errors.description
                  ? 'border-primary focus:border-primary'
                  : 'border-border focus:border-primary/40'
              )}
            />
            {errors.description && (
              <p className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.description}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Define exactly how this market will be resolved. Be specific about sources and conditions.
            </p>
          </div>

          {/* Category and End Date Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-visible">
            {/* Category */}
            <div className={cn(
                "rounded-2xl border border-border bg-card/40 backdrop-blur-xl p-6 relative overflow-visible",
                categoryOpen && "z-50"
              )}>
              <label className="block text-sm font-medium text-foreground mb-2">
                Category <span className="text-muted-foreground">*</span>
              </label>

              {isCreatingNewCategory ? (
                /* New Category Input Mode */
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Enter new category name"
                      className="flex-1 bg-muted border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
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
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      disabled={!newCategoryName.trim()}
                      className="flex-1 py-2 rounded-lg bg-primary/20 border border-primary/30 text-foreground hover:bg-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Create Category
                    </button>
                    <button
                      type="button"
                      onClick={cancelNewCategory}
                      className="px-4 py-2 rounded-lg bg-muted border border-border text-muted-foreground hover:bg-muted/80 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Category Dropdown */
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCategoryOpen(!categoryOpen)}
                    disabled={isLoadingCategories}
                    className={cn(
                      'w-full bg-muted border rounded-xl px-4 py-3 text-left flex items-center justify-between transition-colors',
                      errors.category
                        ? 'border-primary'
                        : 'border-border hover:border-primary/40',
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
                        'h-4 w-4 text-muted-foreground transition-transform',
                        categoryOpen && 'rotate-180'
                      )}
                    />
                  </button>

                  {categoryOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-card/95 border border-border rounded-xl max-h-60 overflow-y-auto z-50">
                      {/* Create New Category Option */}
                      <button
                        type="button"
                        onClick={() => handleCategorySelect('__create_new__')}
                        className="w-full px-4 py-2.5 text-left text-sm transition-colors text-foreground hover:bg-muted border-b border-border flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Create new category
                      </button>

                      {categories.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                          No categories yet. Create one!
                        </div>
                      ) : (
                        categories.map((category) => (
                          <button
                            key={category}
                            type="button"
                            onClick={() => handleCategorySelect(category)}
                            className={cn(
                              'w-full px-4 py-2.5 text-left text-sm transition-colors',
                              formData.category === category
                                ? 'bg-primary/10 text-foreground'
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
                <p className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.category}
                </p>
              )}
            </div>

            {/* End Date & Time */}
            <div className="rounded-2xl border border-border bg-card/40 backdrop-blur-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-foreground">
                  End Date & Time <span className="text-muted-foreground">*</span>
                </label>
              </div>

              {/* Current UTC Time Display */}
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Current UTC:</span>
                <span className="text-xs font-mono text-foreground">{currentUTCTime}</span>
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
                <p className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.endDateTime}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Set the exact date and time when betting closes.
              </p>
            </div>
          </div>

          {/* Resolution Source (Optional) */}
          <div className="rounded-2xl border border-border bg-card/40 backdrop-blur-xl p-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              Resolution Source <span className="text-muted-foreground">(Optional)</span>
            </label>
            <input
              type="text"
              name="resolutionSource"
              value={formData.resolutionSource}
              onChange={handleInputChange}
              placeholder="e.g., https://coinmarketcap.com, Official announcement, etc."
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Specify the official source that will be used to determine the outcome.
            </p>
          </div>

          {/* Summary Card */}
          {formData.title && formData.category && formData.endDateTime && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 backdrop-blur-xl p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Market Preview</h3>
              <div className="space-y-3">
                {imagePreview && (
                  <div>
                    <span className="text-xs text-muted-foreground">Image</span>
                    <img
                      src={imagePreview}
                      alt="Market preview"
                      className="mt-1 w-full h-32 object-cover rounded-lg border border-border"
                    />
                  </div>
                )}
                <div>
                  <span className="text-xs text-muted-foreground">Question</span>
                  <p className="text-foreground font-medium">{formData.title}</p>
                </div>
                {formData.options.filter(o => o.trim()).length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground">Options</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {formData.options.filter(o => o.trim()).map((opt, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 rounded-lg bg-primary/10 text-foreground text-sm"
                        >
                          {opt.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-6">
                  <div>
                    <span className="text-xs text-muted-foreground">Category</span>
                    <p className="text-foreground">{formData.category}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">End Date & Time</span>
                    <p className="text-foreground">
                      {formData.endDateTime?.toLocaleString('en-US', {
                        month: 'short',
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
          )}

          {/* Submit Button */}
          <div className="flex flex-col gap-4">
            {!authenticated && (
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-primary shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Please connect your wallet to create a market.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {txStatus === 'deploying' && 'Deploying to Mantle Sepolia...'}
                  {txStatus === 'saving' && 'Saving market metadata...'}
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

            <p className="text-center text-xs text-muted-foreground">
              By creating a market, you agree to provide accurate resolution based on the criteria defined above.
            </p>
          </div>
        </form>
    </div>
  );
}
