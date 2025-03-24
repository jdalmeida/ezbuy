import { z } from "zod";
import { OrderStatus } from "@prisma/client";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const ordersRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.order.findMany({
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.order.findUnique({
        where: { id: input.id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    }),

  getByCustomerId: publicProcedure
    .input(z.object({ customerId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.order.findMany({
        where: { customerId: input.customerId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        customerId: z.string(),
        items: z.array(
          z.object({
            productId: z.string(),
            quantity: z.number().int().positive(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Buscar produtos para calcular preços
      const productIds = input.items.map((item) => item.productId);
      const products = await ctx.db.product.findMany({
        where: { id: { in: productIds } },
      });

      // Verificar se todos os produtos existem e têm estoque suficiente
      for (const item of input.items) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) {
          throw new Error(`Produto com ID ${item.productId} não encontrado`);
        }
        if (product.stock < item.quantity) {
          throw new Error(`Estoque insuficiente para ${product.name}`);
        }
      }

      // Calcular total e preparar itens
      let total = 0;
      const orderItems = input.items.map((item) => {
        const product = products.find((p) => p.id === item.productId)!;
        const itemTotal = product.price * item.quantity;
        total += itemTotal;

        return {
          productId: item.productId,
          quantity: item.quantity,
          price: product.price,
        };
      });

      // Criar pedido com transação para atualizar estoque
      return ctx.db.$transaction(async (tx) => {
        // Criar pedido
        const order = await tx.order.create({
          data: {
            customerId: input.customerId,
            total,
            items: {
              create: orderItems,
            },
          },
          include: {
            items: true,
          },
        });

        // Atualizar estoque
        for (const item of input.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { decrement: item.quantity },
            },
          });
        }

        return order;
      });
    }),

  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.nativeEnum(OrderStatus),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.order.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),
});
