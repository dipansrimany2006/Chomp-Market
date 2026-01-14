import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db.connection';
import Comment from '@/model/comment.model';

// DELETE /api/comment/[id] - Soft delete a comment
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
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const comment = await Comment.findById(id);

    if (!comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    // Only allow the comment author to delete
    if (comment.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Not authorized to delete this comment' },
        { status: 403 }
      );
    }

    comment.isDeleted = true;
    comment.updatedAt = new Date();
    await comment.save();

    return NextResponse.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/comment/[id] - Like/unlike a comment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { walletAddress, action } = body;

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }

    if (!action || !['like', 'unlike'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "like" or "unlike"' },
        { status: 400 }
      );
    }

    await connectDB();

    const comment = await Comment.findById(id);

    if (!comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const hasLiked = comment.likes.includes(normalizedAddress);

    if (action === 'like' && !hasLiked) {
      comment.likes.push(normalizedAddress);
    } else if (action === 'unlike' && hasLiked) {
      comment.likes = comment.likes.filter(
        (addr: string) => addr.toLowerCase() !== normalizedAddress
      );
    }

    comment.updatedAt = new Date();
    await comment.save();

    return NextResponse.json({
      success: true,
      likes: comment.likes,
      likeCount: comment.likes.length,
    });
  } catch (error) {
    console.error('Error updating comment like:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
