import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getStorage } from "firebase-admin/storage";

export async function GET() {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucket) return NextResponse.json({ error: "Storage not configured" }, { status: 500 });

  try {
    const storage = getStorage();
    const storageBucket = storage.bucket(bucket);

    const [files] = await storageBucket.getFiles({ prefix: "blog-images/" });

    const images = files
      .filter((f) => f.name !== "blog-images/") // skip the folder placeholder
      .map((f) => ({
        name: f.name.replace("blog-images/", ""),
        url: `https://storage.googleapis.com/${bucket}/${f.name}`,
        size: Number(f.metadata.size ?? 0),
        updatedAt: f.metadata.updated ?? f.metadata.timeCreated ?? null,
        contentType: f.metadata.contentType ?? "image/*",
      }))
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));

    return NextResponse.json(images);
  } catch (err) {
    console.error("[GET /api/admin/blog/images]", err);
    return NextResponse.json({ error: "Failed to list images" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucket) return NextResponse.json({ error: "Storage not configured" }, { status: 500 });

  try {
    const { filename } = await req.json() as { filename: string };
    if (!filename || !filename.startsWith("blog-images/")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const storage = getStorage();
    await storage.bucket(bucket).file(filename).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/admin/blog/images]", err);
    return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
  }
}
