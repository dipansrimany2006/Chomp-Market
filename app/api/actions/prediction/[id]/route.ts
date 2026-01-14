import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db.connection';
import Poll from '@/model/poll.model';

// GET /api/actions/prediction/[id] - Get action metadata for a prediction market
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
        { error: 'Prediction market not found' },
        { status: 404 }
      );
    }

    // Get the base URL from the request
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // Return action metadata in a format compatible with MLink
    const actionMetadata = {
      type: 'action',
      icon: poll.imageUrl || `${baseUrl}/logo.png`,
      title: poll.title,
      description: poll.description || `Predict the outcome: ${poll.title}`,
      label: 'Trade Now',
      links: {
        actions: poll.options?.map((option: string, index: number) => ({
          label: `Buy ${option}`,
          href: `${baseUrl}/prediction/${id}?option=${index}`,
        })) || [
          { label: 'Buy Yes', href: `${baseUrl}/prediction/${id}?option=0` },
          { label: 'Buy No', href: `${baseUrl}/prediction/${id}?option=1` },
        ],
      },
      // Additional metadata
      metadata: {
        marketId: id,
        category: poll.category,
        endDate: poll.endDate,
        status: poll.status,
        contractAddress: poll.contractAddress,
        options: poll.options,
        totalVolume: poll.totalVolume,
        totalTrades: poll.totalTrades,
      },
    };

    return NextResponse.json(actionMetadata, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Error fetching action metadata:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
