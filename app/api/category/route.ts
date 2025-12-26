import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db.connection';
import Category from '@/model/category.model';

// GET /api/category - Get all categories
export async function GET() {
  try {
    await connectDB();

    const categories = await Category.find({})
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      categories: categories.map((cat) => cat.name),
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/category - Create a new category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, createdBy } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Category name must be at least 2 characters' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if category already exists (case-insensitive)
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    });

    if (existingCategory) {
      return NextResponse.json({
        success: true,
        category: existingCategory.name,
        message: 'Category already exists',
      });
    }

    const category = new Category({
      name: name.trim(),
      createdBy: createdBy?.toLowerCase(),
    });

    await category.save();

    return NextResponse.json(
      {
        success: true,
        category: category.name,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
