import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { SessionRepository, OpsRepository, requireDb } from "@repo/infrastructure";
import { gameSettlement } from "../../utils/game-settlement.js";
import { getSessionContext } from "../../utils/auth.js";
import { loadInventoryState, persistInventoryState, ALL_ITEMS } from "../../utils/inventory.js";
import * as schema from "@repo/infrastructure/db/schema.js";
import { eq, and, desc } from "drizzle-orm";

const PLATFORM_FEE_RATE = 0.05;

type Listing = typeof schema.marketListings.$inferSelect;

export async function marketListingRoutes(fastify: FastifyInstance) {
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();
  const sessionRepo = new SessionRepository();
  const opsRepo = new OpsRepository();

  const getContext = (req: any) => getSessionContext(req, sessionRepo);

  // GET /api/v1/market-listings - List active listings
  typedFastify.get("/", async (request: any) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ success: false }, request.id, false, "UNAUTHORIZED");

    try {
      const db = await requireDb();
      const listings = await db
        .select()
        .from(schema.marketListings)
        .where(eq(schema.marketListings.status, "active"))
        .orderBy(desc(schema.marketListings.createdAt))
        .limit(100);

      const enriched = listings.map((l: Listing) => {
        const def = ALL_ITEMS[l.itemId];
        return {
          ...l,
          itemName: def?.name || l.itemId,
          itemIcon: def?.icon || "❓",
          itemRarity: def?.rarity || "common",
        };
      });

      return createApiEnvelope({ success: true, data: enriched }, request.id);
    } catch (err: any) {
      return createApiEnvelope({ success: false }, request.id, false, err.message);
    }
  });

  // GET /api/v1/market-listings/mine - My listings
  typedFastify.get("/mine", async (request: any) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ success: false }, request.id, false, "UNAUTHORIZED");

    try {
      const db = await requireDb();
      const listings = await db
        .select()
        .from(schema.marketListings)
        .where(eq(schema.marketListings.sellerId, ctx.userId))
        .orderBy(desc(schema.marketListings.createdAt))
        .limit(100);

      return createApiEnvelope({ success: true, data: listings }, request.id);
    } catch (err: any) {
      return createApiEnvelope({ success: false }, request.id, false, err.message);
    }
  });

  // POST /api/v1/market-listings - Create listing
  typedFastify.post("/", {
    schema: {
      body: z.object({
        sessionId: z.string().optional(),
        itemId: z.string(),
        quantity: z.number().int().min(1).default(1),
        price: z.number().positive(),
        token: z.enum(["zhixi", "yjc"]).default("zhixi"),
      }),
    },
  }, async (request: any) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ success: false }, request.id, false, "UNAUTHORIZED");

    const { itemId, quantity, price, token } = request.body as { itemId: string; quantity: number; price: number; token: string };

    const def = ALL_ITEMS[itemId];
    if (!def) {
      return createApiEnvelope({ success: false }, request.id, false, "未知道具");
    }

    const state = await loadInventoryState(ctx.userId);
    const isAvatarOrTitle = def.type === "avatar" || def.type === "title";
    const owned = isAvatarOrTitle
      ? (def.type === "avatar" && state.ownedAvatars.includes(itemId) ? 1 : 0)
      : (state.inventory[itemId] || 0);
    if (owned < quantity) {
      return createApiEnvelope({ success: false }, request.id, false, "道具數量不足");
    }

    // Deduct from inventory (or ownedAvatars/ownedTitles for avatar/title types)
    const nextState = {
      ...state,
      inventory: { ...state.inventory },
      ownedAvatars: [...state.ownedAvatars],
      ownedTitles: [...state.ownedTitles],
    };
    if (isAvatarOrTitle) {
      if (def.type === "avatar") {
        nextState.ownedAvatars = nextState.ownedAvatars.filter((id: string) => id !== itemId);
      } else {
        nextState.ownedTitles = nextState.ownedTitles.filter((id: string) => id !== itemId);
      }
    } else {
      nextState.inventory[itemId] = owned - quantity;
      if (nextState.inventory[itemId] <= 0) delete nextState.inventory[itemId];
    }
    await persistInventoryState(ctx.userId, nextState);

    // Create listing
    const db = await requireDb();
    const [listing] = await db.insert(schema.marketListings).values({
      sellerId: ctx.userId,
      sellerAddress: ctx.address,
      itemId,
      quantity,
      price: price.toString(),
      token,
    }).returning();

    await opsRepo.logEvent({
      channel: "market",
      severity: "info",
      source: "market_listings",
      kind: "listing_created",
      userId: ctx.userId,
      address: ctx.address,
      message: `Listed ${quantity}x ${itemId} for ${price} ${token}`,
      meta: { itemId, quantity, price, token, listingId: listing.id },
    });

    return createApiEnvelope({ success: true, data: listing }, request.id);
  });

  // DELETE /api/v1/market-listings/:id - Cancel listing
  typedFastify.delete("/:id", async (request: any) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ success: false }, request.id, false, "UNAUTHORIZED");

    const { id } = request.params as { id: string };

    const db = await requireDb();
    const [listing] = await db
      .select()
      .from(schema.marketListings)
      .where(and(eq(schema.marketListings.id, id), eq(schema.marketListings.sellerId, ctx.userId)))
      .limit(1);

    if (!listing) {
      return createApiEnvelope({ success: false }, request.id, false, "LISTING_NOT_FOUND");
    }
    if (listing.status !== "active") {
      return createApiEnvelope({ success: false }, request.id, false, "LISTING_NOT_ACTIVE");
    }

    // Return items to seller
    const state = await loadInventoryState(ctx.userId);
    const cancelDef = ALL_ITEMS[listing.itemId];
    const isAvatarOrTitleCancel = cancelDef && (cancelDef.type === "avatar" || cancelDef.type === "title");
    if (isAvatarOrTitleCancel) {
      if (cancelDef.type === "avatar") {
        if (!state.ownedAvatars.includes(listing.itemId)) state.ownedAvatars.push(listing.itemId);
      } else {
        if (!state.ownedTitles.includes(listing.itemId)) state.ownedTitles.push(listing.itemId);
      }
    } else {
      state.inventory[listing.itemId] = (state.inventory[listing.itemId] || 0) + listing.quantity;
    }
    await persistInventoryState(ctx.userId, state);

    // Update listing status
    await db.update(schema.marketListings)
      .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.marketListings.id, id));

    await opsRepo.logEvent({
      channel: "market",
      severity: "info",
      source: "market_listings",
      kind: "listing_cancelled",
      userId: ctx.userId,
      address: ctx.address,
      message: `Cancelled listing ${id} for ${listing.quantity}x ${listing.itemId}`,
      meta: { listingId: id, itemId: listing.itemId, quantity: listing.quantity },
    });

    return createApiEnvelope({ success: true }, request.id);
  });

  // POST /api/v1/market-listings/:id/buy - Buy listing
  typedFastify.post("/:id/buy", {
    schema: {
      body: z.object({
        sessionId: z.string().optional(),
      }),
    },
  }, async (request: any) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ success: false }, request.id, false, "UNAUTHORIZED");

    const { id } = request.params as { id: string };

    const db = await requireDb();
    const [listing] = await db
      .select()
      .from(schema.marketListings)
      .where(and(eq(schema.marketListings.id, id), eq(schema.marketListings.status, "active")))
      .limit(1);

    if (!listing) {
      return createApiEnvelope({ success: false }, request.id, false, "LISTING_NOT_FOUND");
    }
    if (listing.sellerId === ctx.userId) {
      return createApiEnvelope({ success: false }, request.id, false, "CANNOT_BUY_OWN_LISTING");
    }

    const price = Number(listing.price);
    const fee = Math.round(price * PLATFORM_FEE_RATE);
    const sellerPayout = price - fee;

    // Check buyer balance
    const paymentToken = listing.token === "yjc" ? "yjc" as const : "zhixi" as const;
    const buyerBal = parseFloat(await gameSettlement.getBalance(ctx.address, paymentToken)) || 0;
    if (buyerBal < price) {
      return createApiEnvelope({ success: false }, request.id, false, "餘額不足");
    }

    // Deduct buyer balance
    await gameSettlement.setBalance(ctx.address, paymentToken, (buyerBal - price).toString());

    // Credit seller balance
    const sellerBal = parseFloat(await gameSettlement.getBalance(listing.sellerAddress, paymentToken)) || 0;
    await gameSettlement.setBalance(listing.sellerAddress, paymentToken, (sellerBal + sellerPayout).toString());

    // Grant item to buyer
    const buyerState = await loadInventoryState(ctx.userId);
    buyerState.inventory[listing.itemId] = (buyerState.inventory[listing.itemId] || 0) + listing.quantity;
    await persistInventoryState(ctx.userId, buyerState);

    // Update listing
    await db.update(schema.marketListings)
      .set({
        status: "sold",
        buyerId: ctx.userId,
        buyerAddress: ctx.address,
        soldAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.marketListings.id, id));

    await opsRepo.logEvent({
      channel: "market",
      severity: "info",
      source: "market_listings",
      kind: "listing_sold",
      userId: ctx.userId,
      address: ctx.address,
      message: `Bought ${listing.quantity}x ${listing.itemId} for ${price} ${listing.token}`,
      meta: { listingId: id, itemId: listing.itemId, quantity: listing.quantity, price, fee, sellerPayout, sellerId: listing.sellerId },
    });

    return createApiEnvelope({
      success: true,
      data: {
        itemId: listing.itemId,
        quantity: listing.quantity,
        price,
        fee,
        sellerPayout,
        token: listing.token,
      },
    }, request.id);
  });
}
