export const ACTIVITY_ACTION_OPTIONS = [
  { value: "CALL", label: "Call" },
  { value: "WHATSAPP", label: "WhatsApp" },
] as const;

export function getActivityResponseOptions(action: string) {
  return action === "CALL"
    ? [
        { value: "PICKED_UP", label: "Picked Up" },
        { value: "NO_RESPONSE", label: "No Response" },
        { value: "INVALID_NUMBER", label: "Invalid Number" },
      ]
    : [
        { value: "REPLIED", label: "Replied" },
        { value: "NO_RESPONSE", label: "No Response" },
        { value: "INVALID_NUMBER", label: "Invalid Number" },
      ];
}

export function isSuccessfulActivityResponse(response: string) {
  return response === "PICKED_UP" || response === "REPLIED";
}
