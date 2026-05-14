import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

function getAdminStorage() {
  // Reuse existing admin app or init with storage bucket
  const apps = getApps();
  const app = apps[0];
  return getStorage(app);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Max 5MB." }, { status: 400 });
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucket) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    const storage = getAdminStorage();
    const ext = file.name.split(".").pop() ?? "jpg";
    const filename = `blog-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const storageBucket = storage.bucket(bucket);
    const fileRef = storageBucket.file(filename);

    const buffer = Buffer.from(await file.arrayBuffer());

    await fileRef.save(buffer, {
      metadata: { contentType: file.type },
      public: true,
    });

    const publicUrl = `https://storage.googleapis.com/${bucket}/${filename}`;
    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    console.error("[POST /api/admin/blog/upload-image]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
