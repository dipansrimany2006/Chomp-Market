import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db.connection';
import User from '@/model/user.model';

// GET /api/user?walletAddress=0x...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findOne({
      walletAddress: walletAddress.toLowerCase()
    });

    if (!user) {
      return NextResponse.json(
        { exists: false, user: null },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { exists: true, user: { name: user.name, email: user.email, walletAddress: user.walletAddress } },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, walletAddress } = body;

    if (!name || !walletAddress) {
      return NextResponse.json(
        { error: 'Name and wallet address are required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if user already exists
    const existingUser = await User.findOne({
      walletAddress: walletAddress.toLowerCase()
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this wallet address already exists' },
        { status: 409 }
      );
    }

    // Create new user
    const user = new User({
      name,
      email: email || `${walletAddress.toLowerCase()}@wallet.local`,
      walletAddress: walletAddress.toLowerCase(),
    });

    await user.save();

    return NextResponse.json(
      {
        success: true,
        user: { name: user.name, email: user.email, walletAddress: user.walletAddress }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
