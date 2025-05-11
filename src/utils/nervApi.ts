import { Logger } from "./logger";

// Define the logical image types for the commands.
// These will be mapped to actual URL paths.
export type NERVImageType = "oscar";

const typeToPathMap: Record<NERVImageType, string> = {
    oscar: "oscar",
};

// Function to get an image URL from esmBot files
export async function getNERVImageUrl(type: NERVImageType): Promise<string> {
    const pathSegment = typeToPathMap[type];

    if (!pathSegment || pathSegment.includes("_placeholder")) {
        const errorMessage = `The image API path for type '${type}' is not configured or is a placeholder. Please update esmApi.ts.`;
        Logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    const baseUrl = `https://files.nerv.run/${pathSegment}`;

    try {
        const response = await fetch(baseUrl, {
            method: "HEAD", // Only want headers, not body
            redirect: "follow",
        });

        if (!response.ok) {
            throw new Error(
                `Failed to fetch redirect URL for ${baseUrl}: ${response.status}`,
            );
        }

        // The actual redirected image URL is in `response.url`
        return response.url;
    } catch (err) {
        Logger.error(`Error fetching image for type '${type}':`, err);
        throw err;
    }
}
