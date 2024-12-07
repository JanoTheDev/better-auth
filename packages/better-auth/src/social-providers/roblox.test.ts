import { describe, it, expect, vi } from "vitest";
import { roblox } from "./roblox";
import { betterFetch } from "@better-fetch/fetch";

vi.mock("@better-fetch/fetch");

describe("roblox provider", () => {
	const mockOptions = {
		clientId: "test-clientID",
		clientSecret: "test-clientSecret",
		redirectURI: "http://localhost:3000/api/v1/auth/roblox/oauth/callback",
	};

	const provider = roblox(mockOptions);

	it("should have correct id and name", () => {
		expect(provider.id).toBe("roblox");
		expect(provider.name).toBe("Roblox");
	});

	it("should create correct authorization URL", () => {
		const url = provider.createAuthorizationURL({
			state: "test-state",
			codeVerifier: "test-verifier",
			redirectURI: "http://localhost:3000/api/v1/auth/roblox/oauth/callback",
		});

		expect(url.toString()).toBe(
			"https://authorize.roblox.com/v1/authorize?client_id=test-clientID&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fv1%2Fauth%2Froblox%2Foauth%2Fcallback&scope=openid+profile&response_type=code&state=test-state"
		);
	});

	it("should get user info correctly", async () => {
		const mockProfile = {
			id: 123456,
			name: "TestUser",
			displayName: "Test User",
			description: "Test bio",
			hasVerifiedBadge: true,
			created: "2020-01-01",
			isPremium: true,
			imageUrl: "https://example.com/image.jpg",
		};

		vi.mocked(betterFetch).mockResolvedValueOnce({
			data: mockProfile,
			error: null,
		});

		const result = await provider.getUserInfo({
			accessToken: "test-token",
		});

		expect(result).toEqual({
			user: {
				id: "123456",
				name: "TestUser",
				email: null,
				emailVerified: false,
				image: "https://example.com/image.jpg",
			},
			data: mockProfile,
		});

		expect(betterFetch).toHaveBeenCalledWith(
			"https://apis.roblox.com/oauth/v1/userinfo",
			{
				headers: {
					authorization: "Bearer test-token",
				},
			}
		);
	});

	it("should return null when user info fetch fails", async () => {
		vi.mocked(betterFetch).mockResolvedValueOnce({
			data: null,
			error: new Error("Failed to fetch"),
		});

		const result = await provider.getUserInfo({
			accessToken: "test-token",
		});

		expect(result).toBeNull();
	});

	it("should use custom getUserInfo if provided", async () => {
		const customGetUserInfo = vi.fn().mockResolvedValue({
			user: {
				id: "custom-id",
				name: "Custom User",
				email: null,
				emailVerified: false,
			},
			data: { custom: true },
		});

		const customProvider = roblox({
			...mockOptions,
			getUserInfo: customGetUserInfo,
		});

		const result = await customProvider.getUserInfo({
			accessToken: "test-token",
		});

		expect(customGetUserInfo).toHaveBeenCalledWith({
			accessToken: "test-token",
		});
		expect(result).toEqual({
			user: {
				id: "custom-id",
				name: "Custom User",
				email: null,
				emailVerified: false,
			},
			data: { custom: true },
		});
	});
});
