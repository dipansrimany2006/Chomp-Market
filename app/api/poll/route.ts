import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db.connection';
import Poll from '@/model/poll.model';

// GET /api/poll - Get all polls or filter by query params
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const creatorWalletAddress = searchParams.get('creatorWalletAddress');
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');

    await connectDB();

    // Build query
    const query: Record<string, unknown> = {};

    if (category && category !== 'All') {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }

    if (creatorWalletAddress) {
      query.creatorWalletAddress = creatorWalletAddress.toLowerCase();
    }

    const skip = (page - 1) * limit;

    const [polls, total] = await Promise.all([
      Poll.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Poll.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      polls,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching polls:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/poll - Create a new poll
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      creatorWalletAddress,
      question,
      category,
      resolutionCriteria,
      resolutionSource,
      pollEnd,
      image,
      contractAddress,
      options, // Custom options array
    } = body;

    // Validation
    if (!creatorWalletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    if (!question || question.length < 10) {
      return NextResponse.json(
        { error: 'Question must be at least 10 characters' },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      );
    }

    if (!resolutionCriteria || resolutionCriteria.length < 20) {
      return NextResponse.json(
        { error: 'Resolution criteria must be at least 20 characters' },
        { status: 400 }
      );
    }

    if (!pollEnd) {
      return NextResponse.json(
        { error: 'End date is required' },
        { status: 400 }
      );
    }

    const endDate = new Date(pollEnd);
    if (endDate <= new Date()) {
      return NextResponse.json(
        { error: 'End date must be in the future' },
        { status: 400 }
      );
    }

    if (!image) {
      return NextResponse.json(
        { error: 'Image is required' },
        { status: 400 }
      );
    }

    // Options validation
    if (!options || !Array.isArray(options)) {
      return NextResponse.json(
        { error: 'Options array is required' },
        { status: 400 }
      );
    }

    if (options.length < 2 || options.length > 4) {
      return NextResponse.json(
        { error: 'Must have 2-4 options' },
        { status: 400 }
      );
    }

    // Trim and validate each option
    const trimmedOptions = options.map((o: string) => o.trim());
    const hasEmpty = trimmedOptions.some((o: string) => o.length === 0);
    if (hasEmpty) {
      return NextResponse.json(
        { error: 'All options must have labels' },
        { status: 400 }
      );
    }

    // Check for duplicate options
    const uniqueOptions = new Set(trimmedOptions.map((o: string) => o.toLowerCase()));
    if (uniqueOptions.size !== trimmedOptions.length) {
      return NextResponse.json(
        { error: 'Option labels must be unique' },
        { status: 400 }
      );
    }

    await connectDB();

    // Calculate initial equal odds for all options
    const initialOdds = trimmedOptions.map(() => 100 / trimmedOptions.length);

    const poll = new Poll({
      creatorWalletAddress: creatorWalletAddress.toLowerCase(),
      question,
      category,
      resolutionCriteria,
      resolutionSource: resolutionSource || undefined,
      image,
      pollEnd: endDate,
      options: trimmedOptions,
      odds: initialOdds,
      totalVolume: 0,
      status: 'active',
      contractAddress: contractAddress || undefined,
    });

    await poll.save();

    return NextResponse.json(
      {
        success: true,
        poll: {
          id: poll._id,
          question: poll.question,
          category: poll.category,
          options: poll.options,
          image: poll.image,
          pollEnd: poll.pollEnd,
          contractAddress: poll.contractAddress,
          createdAt: poll.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating poll:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
