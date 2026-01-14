import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db.connection';
import Comment from '@/model/comment.model';
import User from '@/model/user.model';

// GET /api/comment - Get comments for a poll
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pollId = searchParams.get('pollId');
    const sortBy = searchParams.get('sortBy') || 'newest'; // newest, oldest
    const holdersOnly = searchParams.get('holdersOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');

    if (!pollId) {
      return NextResponse.json(
        { error: 'pollId is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const query: Record<string, unknown> = {
      pollId,
      isDeleted: false,
      parentCommentId: { $exists: false }, // Only get top-level comments
    };

    const skip = (page - 1) * limit;
    const sortDirection = sortBy === 'oldest' ? 1 : -1;

    const [comments, total] = await Promise.all([
      Comment.find(query)
        .sort({ createdAt: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      Comment.countDocuments(query),
    ]);

    // Get replies for each comment
    const commentIds = comments.map((c: { _id: string }) => c._id);
    const replies = await Comment.find({
      parentCommentId: { $in: commentIds },
      isDeleted: false,
    })
      .sort({ createdAt: 1 })
      .lean();

    // Group replies by parent comment
    const repliesByParent: Record<string, typeof replies> = {};
    replies.forEach((reply: { parentCommentId: { toString: () => string } }) => {
      const parentId = reply.parentCommentId.toString();
      if (!repliesByParent[parentId]) {
        repliesByParent[parentId] = [];
      }
      repliesByParent[parentId].push(reply);
    });

    // Add replies to comments
    const commentsWithReplies = comments.map((comment: { _id: { toString: () => string } }) => ({
      ...comment,
      replies: repliesByParent[comment._id.toString()] || [],
    }));

    return NextResponse.json({
      success: true,
      comments: commentsWithReplies,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/comment - Create a new comment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pollId, walletAddress, content, parentCommentId } = body;

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

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Comment content is required' },
        { status: 400 }
      );
    }

    if (content.length > 1000) {
      return NextResponse.json(
        { error: 'Comment must be less than 1000 characters' },
        { status: 400 }
      );
    }

    await connectDB();

    // Get user name if available
    const user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
    const userName = user?.name || null;

    const comment = new Comment({
      pollId,
      walletAddress: walletAddress.toLowerCase(),
      userName,
      content: content.trim(),
      likes: [],
      parentCommentId: parentCommentId || undefined,
    });

    await comment.save();

    return NextResponse.json(
      {
        success: true,
        comment: {
          _id: comment._id,
          pollId: comment.pollId,
          walletAddress: comment.walletAddress,
          userName: comment.userName,
          content: comment.content,
          likes: comment.likes,
          parentCommentId: comment.parentCommentId,
          createdAt: comment.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
