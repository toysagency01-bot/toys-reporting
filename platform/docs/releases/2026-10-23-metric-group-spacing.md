# Advertising / CRM group spacing — 2026-10-23

Project CRM metric groups have 32px top spacing on desktop and 24px on phones,
separating them from advertising cards while preserving the smaller gaps within
each group. Build and whitespace checks passed. Six existing browser scenarios
passed: four project template/palette checks and the demo workflow at 1440/390px.
Desktop and phone screenshots were reviewed. No data or metric logic changed.

Implementation: `f8c497b`.
Worker: `924634d0-7fba-4950-8c5c-d58a97c4892e` at 100%, confirmed through Cloudflare.
SHA256: `657ce612b562b564e88a0a78ce140f4b22d197ad3b2c24b10805172fdfe33de3`.
Rollback: `491139b0-d566-4114-80be-599cfebc4946`.
