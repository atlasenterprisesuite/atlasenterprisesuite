import { err, ok, type Result } from '../../core/src';
import { EMPLOYEE_NAME_REQUIRED } from './errors';
import type { EmployeeMutation } from './types';

export function validateEmployeeMutation(
  input: EmployeeMutation,
): Result<EmployeeMutation, string> {
  const fullName = input.fullName.trim();

  if (!fullName) {
    return err(EMPLOYEE_NAME_REQUIRED);
  }

  return ok({
    ...input,
    fullName,
  });
}
