import { betterFetch } from "@better-fetch/fetch";
import type { OAuth2Tokens, OAuthProvider, ProviderOptions } from "../oauth2";
import * as crypto from 'crypto';
import * as jose from 'jose';

const AUTHORIZATION_URL = "https://authorize.roblox.com/v1/authorize";
const JWKS_AUTH = jose.createRemoteJWKSet(new URL('https://apis.roblox.com/oauth/.well-known/jwks.json'));

export interface RobloxProfile {
	sub: string;
	name: string;
	nickname: string;
	preferred_username?: string;
	profile: string;
	picture: string;
	created_at: string;
	premium: boolean;
	nonce?: string;
}

export interface RobloxOptions extends ProviderOptions<RobloxProfile> {
	verifyNonce?: (nonce: string, sessionNonce: string) => boolean;
}

export const roblox = (options: RobloxOptions) => {
	return {
		id: "roblox",
		name: "Roblox",
		createAuthorizationURL({ state, redirectURI }) {
			const nonce = crypto.randomBytes(16).toString('base64url');
			const codeVerifier = crypto.randomBytes(32).toString('base64url');
			const codeChallenge = crypto
				.createHash('sha256')
				.update(codeVerifier)
				.digest('base64url');

			const params = new URLSearchParams({
				client_id: options.clientId,
				redirect_uri: options.redirectURI || redirectURI,
				response_type: 'code',
				scope: 'openid profile',
				prompt: 'login consent select_account',
				state,
				nonce,
				code_challenge: codeChallenge,
				code_challenge_method: 'S256',
			});

			return new URL(`${AUTHORIZATION_URL}?${params}`);
		},

		validateAuthorizationCode: async ({ code, redirectURI, codeVerifier }): Promise<OAuth2Tokens> => {
			const params = new URLSearchParams({
				code,
					code_verifier: codeVerifier || '',
					grant_type: 'authorization_code',
					client_id: options.clientId,
					client_secret: options.clientSecret,
					redirect_uri: options.redirectURI || redirectURI
			});

			const { data: tokens, error } = await betterFetch<OAuth2Tokens & { id_token?: string }>( 
				"https://apis.roblox.com/oauth/v1/token",
				{
					method: 'POST',
					body: params,
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					},
				}
			);

			if (error || !tokens) {
				throw new Error('Failed to validate authorization code');
			}

			if (tokens.id_token) {
				const { payload } = await jose.jwtVerify(tokens.id_token, JWKS_AUTH, {
					issuer: 'https://apis.roblox.com/oauth/',
					audience: options.clientId,
					currentDate: new Date(),
				});

				if (!payload) {
					throw new Error('Invalid ID token payload');
				}
			}

			return tokens;
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

			if (profile.nonce && options.verifyNonce) {
				const isValidNonce = options.verifyNonce(profile.nonce, ''); // You'll need to pass the session nonce
				if (!isValidNonce) {
					return null;
				}
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
