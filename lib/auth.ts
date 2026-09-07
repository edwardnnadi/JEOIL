export type OperationsUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string;
};

const LOCAL_OPERATIONS_USER: OperationsUser = {
  userId: 'local-operations-user',
  displayName: 'JE Oils Operations',
  email: 'operations@jeoils.test',
  fullName: 'JE Oils Operations',
};

/**
 * Authentication has been removed. Keep the shared application identity here
 * so API handlers retain their existing user contract.
 */
export async function authorize(): Promise<OperationsUser> {
  return LOCAL_OPERATIONS_USER;
}
