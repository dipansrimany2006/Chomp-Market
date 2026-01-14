import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db.connection';
import Watchlist from '@/model/watchlist.model';
import Poll from '@/model/poll.model';

// GET /api/watchlist - Get user's watchlist
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const pollId = searchParams.get('pollId');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // If pollId is provided, check if specific market is in watchlist
    if (pollId) {
      const watchlistItem = await Watchlist.findOne({
        walletAddress: walletAddress.toLowerCase(),
        pollId,
      });

      return NextResponse.json({
        success: true,
        isWatched: !!watchlistItem,
      });
    }

    // Otherwise, return all watchlist items with poll details
    const watchlistItems = await Watchlist.find({
      walletAddress: walletAddress.toLowerCase(),
    }).sort({ createdAt: -1 });

    // Get poll details for each watchlist item
    const pollIds = watchlistItems.map((item) => item.pollId);
    const polls = await Poll.find({ _id: { $in: pollIds } }).lean();

    // Create a map for quick lookup
    const pollMap = new Map(polls.map((poll) => [poll._id.toString(), poll]));

    // Combine watchlist with poll data
    const watchlist = watchlistItems
      .map((item) => ({
        ...item.toObject(),
        poll: pollMap.get(item.pollId) || null,
      }))
      .filter((item) => item.poll !== null); // Only include items with valid polls

    return NextResponse.json({
      success: true,
      watchlist,
      total: watchlist.length,
    });
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/watchlist - Add to watchlist
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, pollId } = body;

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }

    if (!pollId) {
      return NextResponse.json(
        { error: 'pollId is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if already in watchlist
    const existing = await Watchlist.findOne({
      walletAddress: walletAddress.toLowerCase(),
      pollId,
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Already in watchlist',
        watchlistItem: existing,
      });
    }

    // Add to watchlist
    const watchlistItem = new Watchlist({
      walletAddress: walletAddress.toLowerCase(),
      pollId,
    });

    await watchlistItem.save();

    return NextResponse.json(
      {
        success: true,
        message: 'Added to watchlist',
        watchlistItem,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/watchlist - Remove from watchlist
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const pollId = searchParams.get('pollId');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }

    if (!pollId) {
      return NextResponse.json(
        { error: 'pollId is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const result = await Watchlist.findOneAndDelete({
      walletAddress: walletAddress.toLowerCase(),
      pollId,
    });

    if (!result) {
      return NextResponse.json({
        success: true,
        message: 'Not in watchlist',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Removed from watchlist',
    });
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
