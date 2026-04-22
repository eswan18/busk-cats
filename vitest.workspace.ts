export default [
  {
    test: {
      name: "node",
      include: ["src-tests/**/*.test.ts"],
      environment: "node",
    },
  },
  "./vitest.config.ts",
];
