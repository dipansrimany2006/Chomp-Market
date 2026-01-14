import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db.connection';
import Activity from '@/model/activity.model';
import User from '@/model/user.model';

// GET /api/activity - Get activity for a poll or user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pollId = searchParams.get('pollId');
    const walletAddress = searchParams.get('walletAddress');
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');

    if (!pollId && !walletAddress) {
      return NextResponse.json(
        { error: 'pollId or walletAddress is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const query: Record<string, unknown> = {};

    if (pollId) {
      query.pollId = pollId;
    }

    if (walletAddress) {
      query.walletAddress = walletAddress.toLowerCase();
    }

    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      Activity.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Activity.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      activities,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/activity - Create a new activity record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      pollId,
      walletAddress,
      action,
      optionIndex,
      optionLabel,
      amount,
      txHash,
    } = body;

    if (!pollId) {
      return NextResponse.json(
        { error: 'pollId is required' },
        { status: 400 }
      );
    }

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }

    if (!action || !['bought', 'sold', 'claimed', 'created'].includes(action)) {
      return NextResponse.json(
        { error: 'Valid action is required (bought, sold, claimed, created)' },
        { status: 400 }
      );
    }

    if (!amount) {
      return NextResponse.json(
        { error: 'amount is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Get user name if available
    const user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
    const userName = user?.name || null;

    const activity = new Activity({
      pollId,
      walletAddress: walletAddress.toLowerCase(),
      userName,
      action,
      optionIndex: optionIndex !== undefined ? optionIndex : null,
      optionLabel: optionLabel || null,
      amount: amount.toString(),
      txHash: txHash || null,
    });

    await activity.save();

    return NextResponse.json(
      {
        success: true,
        activity: {
          _id: activity._id,
          pollId: activity.pollId,
          walletAddress: activity.walletAddress,
          userName: activity.userName,
          action: activity.action,
          optionIndex: activity.optionIndex,
          optionLabel: activity.optionLabel,
          amount: activity.amount,
          txHash: activity.txHash,
          createdAt: activity.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating activity:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
