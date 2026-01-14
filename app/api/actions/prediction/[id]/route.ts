import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db.connection';
import Poll from '@/model/poll.model';

// Define the poll type based on the model
interface PollDocument {
  _id: string;
  question: string;
  category: string;
  resolutionCriteria: string;
  resolutionSource?: string;
  image?: string;
  options: string[];
  winningOptionIndices: number[];
  pollEnd: Date;
  odds?: number[];
  totalVolume: number;
  totalTrades: number;
  status: string;
  contractAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

// GET /api/actions/prediction/[id] - Get action metadata for a prediction market
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await connectDB();

    const poll = await Poll.findById(id).lean() as PollDocument | null;

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

    // Build actions array from poll options
    const actions = poll.options?.map((option: string, index: number) => ({
      label: `Buy ${option}`,
      href: `${baseUrl}/prediction/${id}?option=${index}`,
    })) || [
      { label: 'Buy Yes', href: `${baseUrl}/prediction/${id}?option=0` },
      { label: 'Buy No', href: `${baseUrl}/prediction/${id}?option=1` },
    ];

    // Return action metadata in the format expected by MLink
    const actionMetadata = {
      type: 'action',
      icon: poll.image || `${baseUrl}/logo.png`,
      title: poll.question,
      description: poll.resolutionCriteria || `Predict the outcome: ${poll.question}`,
      label: 'Trade Now',
      actions: actions,
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
