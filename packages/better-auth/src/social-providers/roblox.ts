import { betterFetch } from "@better-fetch/fetch";
import type { OAuthProvider, ProviderOptions } from "../oauth2";
import { validateAuthorizationCode } from "../oauth2";

export interface RobloxProfile {
	sub: string;           // OpenID Connect user identifier
	name: string;          // Username
	nickname: string;      // Display name
	preferred_username?: string;
	profile: string;       // Profile URL
	picture: string;       // Avatar URL
	created_at: string;    // Account creation date
	premium: boolean;      // Premium status
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
						accept: "application/json",
					},
				},
			);

			if (error || !profile) {
				return null;
			}

			const userMap = await options.mapProfileToUser?.(profile);
			return {
				user: {
					id: profile.sub,
					name: profile.preferred_username || profile.name,
					email: null,
					emailVerified: false,
					image: profile.picture,
					...userMap,
				},
				data: profile,
			};
		},
	} satisfies OAuthProvider<RobloxProfile>;
};
