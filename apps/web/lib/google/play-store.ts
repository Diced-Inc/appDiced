import { getAndroidPublisher } from "./auth";

/**
 * Fetch recent reviews for a package.
 * Note: Play API only returns reviews from the last 7 days.
 */
export async function getReviews(packageName: string) {
  const publisher = getAndroidPublisher();
  try {
    const res = await publisher.reviews.list({ packageName });
    return res.data.reviews ?? [];
  } catch (error) {
    console.error(`Failed to fetch reviews for ${packageName}:`, error);
    return [];
  }
}

/**
 * Calculate average rating from recent reviews.
 */
export function calculateAverageRating(
  reviews: Awaited<ReturnType<typeof getReviews>>
): number | null {
  if (reviews.length === 0) return null;

  const ratings = reviews
    .map((r) => r.comments?.[0]?.userComment?.starRating)
    .filter((r): r is number => r != null);

  if (ratings.length === 0) return null;

  return (
    Math.round(
      (ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10
    ) / 10
  );
}
