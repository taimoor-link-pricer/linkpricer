// DEPRECATED — do not use.
//
// This was a duplicate of the tips banner, added by mistake without
// realizing components/dashboard/TipsBanner.tsx already existed and is
// wired into app/dashboard/layout.tsx (renders on every /dashboard/* page).
// That's the real component — fix/extend TipsBanner.tsx instead.
//
// Left in place only because this environment can't delete files; nothing
// imports this anymore. Safe to actually delete next time someone has file
//-system delete access.
export {};
