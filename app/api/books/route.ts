import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json(
      { error: "Query parameter is required" },
      { status: 400 },
    );
  }

  const apiKey = process.env.KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "API key not configured" },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(query)}&maxResults=5&key=${apiKey}`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch books");
    }
    console.log(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(query)}&maxResults=5&key=${apiKey}`);

    const data = await response.json();
    // Transform the data to a simpler format
    const books =
      data.items?.map((item: any) => ({
        id: item.id,
        title: item.volumeInfo.title,
        author: item.volumeInfo.authors?.[0] || "Unknown Author",
        cover:
          item.volumeInfo.imageLinks?.extraLarge ||
          item.volumeInfo.imageLinks?.large ||
          item.volumeInfo.imageLinks?.medium ||
          item.volumeInfo.imageLinks?.smallThumbnail ||
          item.volumeInfo.imageLinks?.thumbnail
            ?.replace("http://", "https://") ||
          "",
        genre: item.volumeInfo.categories?.[0] || "General Fiction",
        description: item.volumeInfo.description || "",
        pageCount: item.volumeInfo.pageCount || 0,
        publishedDate: item.volumeInfo.publishedDate || "",
        etag: item.etag,
      })) || [];

    return NextResponse.json({ books });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch books" },
      { status: 500 },
    );
  }
}
