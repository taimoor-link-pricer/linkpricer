import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getStorage } from "firebase-admin/storage";
import { fileTypeFromBuffer } from "file-type";

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

    const buffer = Buffer.from(await file.arrayBuffer());

    // file.type is just the client-declared form-part Content-Type — trivially
    // spoofable by anyone crafting the multipart body directly, so the check
    // above only rejects an honest client, not a deliberate one. Verify the
    // actual bytes via magic-byte sniffing and use ITS answer (not the
    // client's) for both the allowlist check and the stored object's
    // contentType, so a mislabeled or malicious upload can't pass as an
    // image, and a real image never gets served with the wrong header.
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || !allowed.includes(detected.mime)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucket) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    const storage = getStorage();
    const filename = `blog-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${detected.ext}`;
    const storageBucket = storage.bucket(bucket);
    const fileRef = storageBucket.file(filename);

    await fileRef.save(buffer, {
      metadata: { contentType: detected.mime },
      public: true,
    });

    const publicUrl = `https://storage.googleapis.com/${bucket}/${filename}`;
    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    console.error("[POST /api/admin/blog/upload-image]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
