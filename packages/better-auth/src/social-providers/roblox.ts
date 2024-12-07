import { betterFetch } from "@better-fetch/fetch";
import type { OAuthProvider, ProviderOptions } from "../oauth2";
import { validateAuthorizationCode } from "../oauth2";

export interface RobloxProfile extends Record<string, any> {
	/** the user's id */
	id: number;
	/** the user's name */
	name: string;
	/** the user's display name */
	displayName: string;
	/** the user's description/bio */
	description: string;
	/** whether the user is verified */
	hasVerifiedBadge: boolean;
	/** when the user created their account */
	created: string;
	/** whether the user has premium membership */
	isPremium: boolean;
	/** the user's profile image URL */
	imageUrl: string;
}

export interface RobloxOptions extends ProviderOptions<RobloxProfile> {}

export const roblox = (options: RobloxOptions) => {
	return {
		id: "roblox",
		name: "Roblox",
		createAuthorizationURL({ state, redirectURI }) {
			return new URL(
				`https://authorize.roblox.com/v1/authorize?client_id=${
					options.clientId
				}&redirect_uri=${encodeURIComponent(
					options.redirectURI || redirectURI
				)}&scope=openid+profile&response_type=code&state=${state}`,
			);
		},
		validateAuthorizationCode: async ({ code, redirectURI }) => {
			return validateAuthorizationCode({
				code,
				redirectURI: options.redirectURI || redirectURI,
				options,
				tokenEndpoint: "https://apis.roblox.com/oauth/v1/token",
			});
		},
		async getUserInfo(token) {
			if (options.getUserInfo) {
				return options.getUserInfo(token);
			}

			const { data: profile, error } = await betterFetch<RobloxProfile>(
				"https://apis.roblox.com/oauth/v1/userinfo",
				{
					headers: {
						authorization: `Bearer ${token.accessToken}`,
					},
				},
			);

			if (error) {
				return null;
			}

			const userMap = await options.mapProfileToUser?.(profile);
			return {
				user: {
					id: profile.id.toString(),
					name: profile.name,
					email: null, // Roblox doesn't provide email
					emailVerified: false,
					image: profile.imageUrl,
					...userMap,
				},
				data: profile,
			};
		},
	} satisfies OAuthProvider<RobloxProfile>;
};
