import axios, { type AxiosError } from "axios";

export class WhatsAppClient {
  private token: string;
  private phoneNumberId: string;
  private baseUrl = "https://graph.facebook.com/v22.0";

  constructor(token: string, phoneNumberId: string) {
    this.token = token;
    this.phoneNumberId = phoneNumberId;
  }

  async sendTextMessage(to: string, text: string) {
    try {
      console.log("Sending WhatsApp message to:", to);
      console.log("Message content:", text);
      console.log(`${this.baseUrl}/${this.phoneNumberId}/messages`);
      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { body: text },
        },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
        },
      );

      console.dir(response);

      return response.data;
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
      console.dir((error as AxiosError).response);
      throw error;
    }
  }

  async markAsRead(messageId: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error("Error marking message as read:", error);
      throw error;
    }
  }
}
