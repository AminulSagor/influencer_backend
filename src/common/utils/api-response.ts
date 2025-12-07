export const ApiResponse = (success: boolean, message: string, data?: any) => ({
  success,
  message,
  data,
});
