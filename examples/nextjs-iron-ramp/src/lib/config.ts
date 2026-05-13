export const config = {
  dynamic: {
    environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID!,
  },
  api: {
    baseUrl: "",
  },
} as const;
