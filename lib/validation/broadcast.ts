import { z } from 'zod';

/**
 * FR-052/research.md item 2: a broadcast's icon is a key into this app's
 * built-in icon set (not an uploaded file) -- the curated set added in
 * components/icons.tsx (T014), plus the existing megaphone as a fallback.
 */
export const broadcastIconSchema = z.enum(['fire', 'water-drop', 'warning-triangle', 'megaphone']);
export type BroadcastIcon = z.infer<typeof broadcastIconSchema>;

/** FR-051: send a custom or template-sourced broadcast. */
export const sendBroadcastSchema = z.object({
  message: z.string().trim().min(1, 'A message is required').max(2000),
  template_id: z.string().uuid().nullable().optional(),
});
export type SendBroadcastInput = z.infer<typeof sendBroadcastSchema>;

/** FR-052: save a message as a reusable predetermined broadcast. */
export const saveTemplateSchema = z.object({
  message: z.string().trim().min(1, 'A message is required').max(2000),
  icon: broadcastIconSchema.nullable().optional(),
});
export type SaveTemplateInput = z.infer<typeof saveTemplateSchema>;

export const updateTemplateSchema = z.object({
  template_id: z.string().uuid(),
  message: z.string().trim().min(1, 'A message is required').max(2000),
  icon: broadcastIconSchema.nullable().optional(),
});
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

/** FR-053: the Staff-broadcast-permission toggle, default off. */
export const setStaffBroadcastPermissionSchema = z.object({
  enabled: z.boolean(),
});
export type SetStaffBroadcastPermissionInput = z.infer<typeof setStaffBroadcastPermissionSchema>;
