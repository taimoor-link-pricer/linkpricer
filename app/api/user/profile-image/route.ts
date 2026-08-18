import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getStorage } from "firebase-admin/storage";
import { fileTypeFromBuffer } from "file-type";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

// Uploads the caller's own profile photo -- uid comes from the verified
// session cookie, never from the request body, so this can only ever write
// to that user's own storage path and their own users row.
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session")?.value;
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await adminAuth.verifySessionCookie(session, true);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Max 5MB." }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Use JPEG, PNG, or WebP." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // file.type is just the client-declared form-part Content-Type -- verify
    // the actual bytes via magic-byte sniffing (same defense as the blog
    // upload-image route) and use ITS answer, so a mislabeled or malicious
    // upload can't pass as an image.
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || !ALLOWED.includes(detected.mime)) {
      return NextResponse.json({ error: "Invalid file type. Use JPEG, PNG, or WebP." }, { status: 400 });
    }

    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucket) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    const [existing] = await db
      .select({ profileImageUrl: users.profileImageUrl })
      .from(users)
      .where(eq(users.id, decoded.uid))
      .limit(1);

    const storage = getStorage();
    const storageBucket = storage.bucket(bucket);
    const filename = `profile-images/${decoded.uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${detected.ext}`;
    const fileRef = storageBucket.file(filename);

    await fileRef.save(buffer, {
      metadata: { contentType: detected.mime },
      public: true,
    });

    const publicUrl = `https://storage.googleapis.com/${bucket}/${filename}`;

    await db.update(users).set({ profileImageUrl: publicUrl }).where(eq(users.id, decoded.uid));

    // Best-effort cleanup of the previous photo -- never block the response
    // on it, and only touch objects under this user's own upload path (e.g.
    // skip a Google-account photo URL that predates any real upload).
    const oldPrefix = `https://storage.googleapis.com/${bucket}/profile-images/${decoded.uid}/`;
    if (existing?.profileImageUrl?.startsWith(oldPrefix)) {
      storageBucket
        .file(existing.profileImageUrl.slice(`https://storage.googleapis.com/${bucket}/`.length))
        .delete()
        .catch(() => {});
    }

    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    console.error("[POST /api/user/profile-image]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
