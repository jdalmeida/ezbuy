import { z } from "zod";
import { tool } from "ai";
import { db } from "@/server/db";
import { matchProductsInText } from "@/utils/productMatcher";

export const productSearchTool = tool({
  description: "productSearch - Pesquisa produtos pelo nome ou descrição",
  parameters: z.object({
    query: z.string().describe("Termos de pesquisa para encontrar produtos"),
  }),
  execute: async ({ query }) => {
    const products = await db.product.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
    });

    return { products };
  },
});

export const productInfoTool = tool({
  description:
    "productInfo - Obtém informações detalhadas de um produto específico pelo ID",
  parameters: z.object({
    productId: z.string().describe("ID do produto"),
  }),
  execute: async ({ productId }) => {
    const product = await db.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return { error: `Produto com ID ${productId} não encontrado` };
    }

    return { product };
  },
});

export const createOrderTool = tool({
  description: "createOrder - Cria um novo pedido com os itens especificados",
  parameters: z.object({
    customerId: z.string().describe("ID do cliente (número do WhatsApp)"),
    items: z.array(
      z.object({
        productId: z.string().describe("ID do produto"),
        quantity: z.number().int().positive().describe("Quantidade do produto"),
      }),
    ),
  }),
  execute: async ({ customerId, items }) => {
    try {
      // Buscar produtos para calcular preços
      const productIds = items.map((item) => item.productId);
      const products = await db.product.findMany({
        where: { id: { in: productIds } },
      });

      // Verificar se todos os produtos existem e têm estoque suficiente
      const unavailableProducts = [];

      for (const item of items) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) {
          unavailableProducts.push({ id: item.productId, reason: "not found" });
          continue;
        }

        if (product.stock < item.quantity) {
          unavailableProducts.push({
            id: item.productId,
            name: product.name,
            reason: "insufficient stock",
            available: product.stock,
          });
        }
      }

      if (unavailableProducts.length > 0) {
        return { success: false, unavailableProducts };
      }

      // Calcular total e preparar itens
      let total = 0;
      const orderItems = items.map((item) => {
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
      const order = await db.$transaction(async (tx) => {
        // Criar pedido
        const newOrder = await tx.order.create({
          data: {
            customerId,
            total,
            items: {
              create: orderItems,
            },
          },
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        });

        // Atualizar estoque
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { decrement: item.quantity },
            },
          });
        }

        return newOrder;
      });

      return {
        success: true,
        order: {
          id: order.id,
          total: order.total,
          items: order.items.map((item) => ({
            product: item.product.name,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.quantity * item.price,
          })),
        },
      };
    } catch (error) {
      console.error("Error creating order:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao criar pedido",
      };
    }
  },
});

export const extractProductsFromTextTool = tool({
  description:
    "extractProductsFromTextTool - Extrai menções a produtos e suas quantidades de um texto",
  parameters: z.object({
    text: z.string().describe("Texto da mensagem do cliente"),
  }),
  execute: async ({ text }) => {
    const allProducts = await db.product.findMany();
    const matchedProducts = await matchProductsInText(text, allProducts);

    return {
      matchedProducts: matchedProducts.map((match) => ({
        id: match.product.id,
        name: match.product.name,
        price: match.product.price,
        quantity: match.quantity,
        subtotal: match.product.price * match.quantity,
        available: match.product.stock >= match.quantity,
        stock: match.product.stock,
      })),
    };
  },
});

export const checkAvailabilityTool = tool({
  description:
    "checkAvailabilityTool - Verifica se produtos estão disponíveis em estoque nas quantidades desejadas",
  parameters: z.object({
    items: z.array(
      z.object({
        productId: z.string().describe("ID do produto"),
        quantity: z.number().int().positive().describe("Quantidade desejada"),
      }),
    ),
  }),
  execute: async ({ items }) => {
    const productIds = items.map((item) => item.productId);
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
    });

    const results = items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        return {
          productId: item.productId,
          found: false,
          available: false,
        };
      }

      return {
        productId: item.productId,
        name: product.name,
        found: true,
        available: product.stock >= item.quantity,
        requested: item.quantity,
        inStock: product.stock,
        price: product.price,
      };
    });

    return { results };
  },
});
