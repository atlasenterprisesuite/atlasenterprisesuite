/** Owner-controlled ATLAS runtime policy. The independent CLI uses strict offline mode. */
export function resolveLocalRuntimeConfiguration(env = process.env) {
  const host = String(env.ATLAS_LOCAL_AI_HOST || '127.0.0.1').trim();
  // Numeric loopback avoids DNS and hostname rebinding surprises.
  if (!['127.0.0.1', '::1'].includes(host)) throw new Error('local_core_runtime_loopback_required');

  const port = String(env.ATLAS_LOCAL_AI_PORT || '8080').trim();
  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('local_core_invalid_port');

  const context = String(env.ATLAS_LOCAL_AI_CONTEXT || '32768').trim();
  if (!/^\d+$/.test(context) || Number(context) < 128 || Number(context) > 131072) throw new Error('local_core_invalid_context');

  const token = String(env.ATLAS_LOCAL_AI_TOKEN || '').trim();
  if (!token) throw new Error('local_core_token_required');

  const modelFile = String(env.ATLAS_LOCAL_AI_MODEL_FILE || '').trim();
  const hfRepo = String(env.ATLAS_LOCAL_AI_HF_REPO || '').trim();
  const offline = env.ATLAS_LOCAL_AI_OFFLINE === 'true';
  if (offline && (hfRepo || !modelFile)) throw new Error('local_core_offline_model_file_required');
  if (!modelFile && !hfRepo) throw new Error('local_core_model_required');

  const binary = String(env.ATLAS_LOCAL_AI_BINARY || 'llama-server').trim();
  const modelAlias = String(env.ATLAS_LOCAL_AI_MODEL_ALIAS || 'atlas-local-default').trim();
  if (!binary) throw new Error('local_core_binary_required');
  if (!/^[a-zA-Z0-9._:/-]{1,120}$/.test(modelAlias)) throw new Error('local_core_invalid_model_alias');

  const gpuLayers = String(env.ATLAS_LOCAL_AI_GPU_LAYERS || '').trim();
  if (gpuLayers && gpuLayers !== 'all' && !/^-?\d+$/.test(gpuLayers)) throw new Error('local_core_invalid_gpu_layers');

  const args = ['--host', host, '--port', port, '-c', context, '--jinja', '--alias', modelAlias];
  if (modelFile) args.push('-m', modelFile);
  else args.push('-hf', hfRepo);
  if (gpuLayers) args.push('-ngl', gpuLayers);
  return { binary, args, token, offline };
}
