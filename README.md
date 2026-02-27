# 🛍️ EzBuy — Sales Chatbot

> ⚠️ **Archived project.** This repository is no longer actively maintained and is open-sourced for reference and learning purposes.

EzBuy is a sales-focused chatbot platform built with the T3 Stack. It allows businesses to create a conversational interface for their products, enabling customers to browse, ask questions, and complete purchases through a chat experience right in their whatsapp.

---

## ✨ Features

- 💬 Conversational sales interface
- 🔐 Authentication with NextAuth.js
- 🗄️ Database-backed product and order management via Prisma
- ⚡ Type-safe API with tRPC
- 🎨 Modern UI with Tailwind CSS and shadcn/ui
- 📦 Built on the T3 Stack for a robust, full-stack TypeScript experience

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js](https://nextjs.org) |
| API | [tRPC](https://trpc.io) |
| ORM | [Prisma](https://prisma.io) |
| Auth | [NextAuth.js](https://next-auth.js.org) |
| Styling | [Tailwind CSS](https://tailwindcss.com) |
| Package Manager | [pnpm](https://pnpm.io) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Docker (for local database) or a PostgreSQL instance

### Installation

```bash
# Clone the repository
git clone https://github.com/jdalmeida/ezbuy.git
cd ezbuy

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Database Setup

You can start a local PostgreSQL database using the provided script:

```bash
./start-database.sh
```

Then run the Prisma migrations:

```bash
pnpm prisma migrate dev
```

### Running the App

```bash
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```env
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"

# Add any other provider keys as needed
```

---

## 🗂️ Project Structure

```
ezbuy/
├── prisma/          # Database schema and migrations
├── public/          # Static assets
├── src/             # Application source code
│   ├── pages/       # Next.js pages
│   ├── server/      # tRPC routers and server logic
│   └── components/  # UI components
├── .env.example     # Environment variable template
└── start-database.sh # Local DB startup script
```

---

## 📦 Deployment

This project can be deployed to Vercel, Netlify, or Docker. Refer to the [T3 Stack deployment docs](https://create.t3.gg/en/deployment/vercel) for detailed instructions.

---

## 📄 License

This project is open-sourced under the [MIT License](LICENSE).

---

## 🙏 Acknowledgements

Bootstrapped with [create-t3-app](https://create.t3.gg/).
