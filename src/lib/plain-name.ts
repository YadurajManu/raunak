/** Keep names readable in PDF and plain-text channels whose fonts may not include emoji. */
export function plainName(value: string) {
  return value
    .replace(
      /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|[\p{Extended_Pictographic}\p{Emoji_Presentation}](?:\uFE0F|\uFE0E|\p{Emoji_Modifier}|\u200D[\p{Extended_Pictographic}\p{Emoji_Presentation}]\p{Emoji_Modifier}?)*)/gu,
      "",
    )
    .replace(/\u200D|\uFE0F|\p{Emoji_Modifier}/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
