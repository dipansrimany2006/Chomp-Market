import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db.connection';
import Activity from '@/model/activity.model';

// GET /api/holders - Get aggregated holders for a poll
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pollId = searchParams.get('pollId');

    if (!pollId) {
      return NextResponse.json(
        { error: 'pollId is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Aggregate activities to calculate net positions per user per option
    const holdersAggregation = await Activity.aggregate([
      { $match: { pollId: pollId } },
      {
        $group: {
          _id: {
            walletAddress: '$walletAddress',
            optionIndex: '$optionIndex',
          },
          userName: { $last: '$userName' },
          totalBought: {
            $sum: {
              $cond: [{ $eq: ['$action', 'bought'] }, { $toDouble: '$amount' }, 0]
            }
          },
          totalSold: {
            $sum: {
              $cond: [{ $eq: ['$action', 'sold'] }, { $toDouble: '$amount' }, 0]
            }
          },
          optionLabel: { $last: '$optionLabel' },
          lastActivity: { $max: '$createdAt' },
        }
      },
      {
        $project: {
          walletAddress: '$_id.walletAddress',
          optionIndex: '$_id.optionIndex',
          userName: 1,
          optionLabel: 1,
          netPosition: { $subtract: ['$totalBought', '$totalSold'] },
          totalBought: 1,
          totalSold: 1,
          lastActivity: 1,
        }
      },
      { $match: { netPosition: { $gt: 0 } } }, // Only include positive positions
      { $sort: { netPosition: -1 } },
    ]);

    // Group by wallet address to combine all their positions
    const holdersMap = new Map<string, {
      walletAddress: string;
      userName: string | null;
      positions: Array<{
        optionIndex: number;
        optionLabel: string;
        amount: number;
      }>;
      totalValue: number;
      lastActivity: Date;
    }>();

    holdersAggregation.forEach((holder) => {
      const existing = holdersMap.get(holder.walletAddress);
      if (existing) {
        existing.positions.push({
          optionIndex: holder.optionIndex,
          optionLabel: holder.optionLabel || `Option ${holder.optionIndex + 1}`,
          amount: holder.netPosition,
        });
        existing.totalValue += holder.netPosition;
        if (new Date(holder.lastActivity) > existing.lastActivity) {
          existing.lastActivity = holder.lastActivity;
        }
      } else {
        holdersMap.set(holder.walletAddress, {
          walletAddress: holder.walletAddress,
          userName: holder.userName,
          positions: [{
            optionIndex: holder.optionIndex,
            optionLabel: holder.optionLabel || `Option ${holder.optionIndex + 1}`,
            amount: holder.netPosition,
          }],
          totalValue: holder.netPosition,
          lastActivity: holder.lastActivity,
        });
      }
    });

    // Convert to array and sort by total value
    const holders = Array.from(holdersMap.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 20); // Top 20 holders

    return NextResponse.json({
      success: true,
      holders,
      totalHolders: holdersMap.size,
    });
  } catch (error) {
    console.error('Error fetching holders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
