import { type NextRequest, NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { WhatsAppClient } from "@/lib/whatsapp";
import {
  productSearchTool,
  productInfoTool,
  createOrderTool,
  extractProductsFromTextTool,
  checkAvailabilityTool,
} from "@/server/ai/tools";
import { generateText, type CoreMessage } from "ai";
import { db } from "@/server/db";

// Inicializar os clientes
const whatsappClient = new WhatsAppClient(
  process.env.WHATSAPP_TOKEN as string,
  process.env.WHATSAPP_PHONE_NUMBER_ID as string,
);

export async function GET(req: NextRequest) {
  // Verificação do webhook - requerido pela Meta
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge);
  }

  return new NextResponse("Verification failed", { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.dir(body);
    // Verificar se é uma mensagem válida do WhatsApp
    if (
      body.object &&
      body.entry &&
      body.entry[0].changes &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]
    ) {
      const phoneNumberId =
        body.entry[0].changes[0].value.metadata.phone_number_id;
      const from = body.entry[0].changes[0].value.messages[0].from;
      const messageId = body.entry[0].changes[0].value.messages[0].id;
      const messageType = body.entry[0].changes[0].value.messages[0].type;

      // Processar apenas mensagens de texto
      if (messageType === "text") {
        const messageText =
          body.entry[0].changes[0].value.messages[0].text.body;

        let prevMessages = await db.assistantMessages.findUnique({
          where: {
            senderId: from,
          },
        });

        if (!prevMessages) {
          prevMessages = await db.assistantMessages.create({
            data: {
              senderId: from,
              messages: [
                {
                  role: "system",
                  content: `Você é um assistente de vendas que ajuda os clientes a fazer pedidos pelo WhatsApp.
                  Use as ferramentas disponíveis para pesquisar produtos, extrair menções a produtos do texto do cliente,
                  verificar disponibilidade e criar pedidos. Seja cordial, direto e eficiente. Não mencione que você é uma IA.
                  Tente entender o que o cliente deseja comprar, em quais quantidades, e ajude a finalizar o pedido.
                  Sempre verifique a disponibilidade antes de criar o pedido e informe se algum produto não está disponível na quantidade solicitada.

                  Após criar um pedido com sucesso, forneça um resumo com os itens, quantidades, preços e total.`,
                },
                { role: "user", content: messageText },
              ],
            },
          });
        } else {
          prevMessages = await db.assistantMessages.update({
            data: {
              messages: {
                push: {
                  role: "user",
                  content: messageText,
                },
              },
            },
            where: {
              id: prevMessages.id,
            },
          });
        }

        // Marcar como lida
        await whatsappClient.markAsRead(messageId);

        // Informar ao cliente que estamos processando a mensagem
        await whatsappClient.sendTextMessage(
          from,
          "Estou processando sua solicitação...",
        );

        try {
          // Usar generateText em vez de streamText para evitar problemas com o streaming
          const { text, toolCalls } = await generateText({
            model: openai("gpt-4o"),
            messages: prevMessages.messages as CoreMessage[],
            tools: {
              productSearchTool,
              productInfoTool,
              createOrderTool,
              extractProductsFromTextTool,
              checkAvailabilityTool,
            },
          });

          // Se houver chamadas de ferramentas, processar cada uma
          if (toolCalls && toolCalls.length > 0) {
            // Informar ao cliente que estamos processando dados
            await whatsappClient.sendTextMessage(
              from,
              "Estou buscando informações para você...",
            );

            // Criar um array para armazenar as mensagens da conversa
            const conversationMessages = prevMessages.messages as CoreMessage[];

            // Processar cada chamada de ferramenta
            for (const toolCall of toolCalls) {
              try {
                let toolResult;

                // Executar a ferramenta apropriada
                switch (toolCall.toolName) {
                  case "productSearchTool":
                    toolResult = await productSearchTool.execute(
                      toolCall.args,
                      {
                        toolCallId: toolCall.toolCallId,
                        messages: conversationMessages,
                      },
                    );
                    break;
                  case "productInfoTool":
                    toolResult = await productInfoTool.execute(toolCall.args, {
                      toolCallId: toolCall.toolCallId,
                      messages: conversationMessages,
                    });
                    break;
                  case "createOrderTool":
                    toolResult = await createOrderTool.execute(toolCall.args, {
                      toolCallId: toolCall.toolCallId,
                      messages: conversationMessages,
                    });
                    break;
                  case "extractProductsFromTextTool":
                    toolResult = await extractProductsFromTextTool.execute(
                      toolCall.args,
                      {
                        toolCallId: toolCall.toolCallId,
                        messages: conversationMessages,
                      },
                    );
                    break;
                  case "checkAvailabilityTool":
                    toolResult = await checkAvailabilityTool.execute(
                      toolCall.args,
                      {
                        toolCallId: toolCall.toolCallId,
                        messages: conversationMessages,
                      },
                    );
                    break;
                }

                // Adicionar resultado da ferramenta à conversa
                conversationMessages.push({
                  role: "assistant",
                  content: `${toolCall.toolName}: ${JSON.stringify(toolResult)}`,
                });
              } catch (error) {
                console.error(
                  `Error executing tool ${toolCall.toolName}:`,
                  error,
                );

                // Adicionar erro à conversa
                conversationMessages.push({
                  role: "assistant",
                  content: JSON.stringify({
                    error: `${toolCall.toolName}: Erro ao executar a ferramenta`,
                  }),
                });
              }
            }

            // Gerar resposta final com base nos resultados das ferramentas
            const finalResult = await generateText({
              model: openai("gpt-4o"),
              messages: conversationMessages,
            });

            // Enviar a resposta final
            await whatsappClient.sendTextMessage(from, finalResult.text);

            await db.assistantMessages.update({
              data: {
                messages: {
                  push: {
                    role: "assistant",
                    content: finalResult.text,
                  },
                },
              },
              where: {
                id: prevMessages.id,
              },
            });
          } else {
            // Se não houver chamadas de ferramentas, enviar a resposta diretamente
            await whatsappClient.sendTextMessage(from, text);
            await db.assistantMessages.update({
              data: {
                messages: {
                  push: {
                    role: "assistant",
                    content: text,
                  },
                },
              },
              where: {
                id: prevMessages.id,
              },
            });
          }
        } catch (error) {
          console.error("Error processing message with AI:", error);
          await whatsappClient.sendTextMessage(
            from,
            "Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente mais tarde.",
          );
        }
      }
    }

    return new NextResponse("OK");
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new NextResponse("Error processing webhook", { status: 500 });
  }
}
