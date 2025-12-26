import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db.connection';
import Poll from '@/model/poll.model';

// GET /api/poll/[id] - Get a single poll by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await connectDB();

    const poll = await Poll.findById(id).lean();

    if (!poll) {
      return NextResponse.json(
        { error: 'Poll not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      poll,
    });
  } catch (error) {
    console.error('Error fetching poll:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/poll/[id] - Update a poll (e.g., resolve it)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, yesPrice, noPrice, totalVolume, winningOptionIndices, walletAddress } = body;

    await connectDB();

    const poll = await Poll.findById(id);

    if (!poll) {
      return NextResponse.json(
        { error: 'Poll not found' },
        { status: 404 }
      );
    }

    // For resolve/cancel actions, verify the requester is the creator
    if ((status === 'resolved' || status === 'cancelled') && walletAddress) {
      if (poll.creatorWalletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return NextResponse.json(
          { error: 'Only the creator can resolve or cancel this market' },
          { status: 403 }
        );
      }
    }

    // Update allowed fields
    if (status && ['active', 'resolved', 'cancelled'].includes(status)) {
      poll.status = status;
    }

    // Update winning option indices when resolving
    if (Array.isArray(winningOptionIndices) && winningOptionIndices.length > 0) {
      poll.winningOptionIndices = winningOptionIndices;
    }

    if (typeof yesPrice === 'number') {
      poll.yesPrice = yesPrice;
      poll.noPrice = 100 - yesPrice;
    }

    if (typeof totalVolume === 'number') {
      poll.totalVolume = totalVolume;
    }

    poll.updatedAt = new Date();

    await poll.save();

    return NextResponse.json({
      success: true,
      poll: {
        id: poll._id,
        status: poll.status,
        yesPrice: poll.yesPrice,
        noPrice: poll.noPrice,
        totalVolume: poll.totalVolume,
        winningOptionIndices: poll.winningOptionIndices,
        updatedAt: poll.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating poll:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/poll/[id] - Delete a poll (only by creator)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const poll = await Poll.findById(id);

    if (!poll) {
      return NextResponse.json(
        { error: 'Poll not found' },
        { status: 404 }
      );
    }

    // Check if the requester is the creator
    if (poll.creatorWalletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Only the creator can delete this poll' },
        { status: 403 }
      );
    }

    await Poll.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Poll deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting poll:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
