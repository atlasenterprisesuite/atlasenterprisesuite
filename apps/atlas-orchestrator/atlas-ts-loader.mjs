export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    if (!relative) throw error;

    if (error?.code === 'ERR_UNSUPPORTED_DIR_IMPORT') {
      return nextResolve(`${specifier}/index.ts`, context);
    }

    if (error?.code === 'ERR_MODULE_NOT_FOUND') {
      try {
        return await nextResolve(`${specifier}.ts`, context);
      } catch (nested) {
        if (nested?.code === 'ERR_UNSUPPORTED_DIR_IMPORT' || nested?.code === 'ERR_MODULE_NOT_FOUND') {
          return nextResolve(`${specifier}/index.ts`, context);
        }
        throw nested;
      }
    }

    throw error;
  }
}
