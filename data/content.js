import { PROVERBS_CONTENT_01 } from "./proverbs/part-01.js";
import { PROVERBS_CONTENT_02 } from "./proverbs/part-02.js";
import { PROVERBS_CONTENT_03 } from "./proverbs/part-03.js";
import { PROVERBS_CONTENT_04 } from "./proverbs/part-04.js";

const days = [
  ...PROVERBS_CONTENT_01,
  ...PROVERBS_CONTENT_02,
  ...PROVERBS_CONTENT_03,
  ...PROVERBS_CONTENT_04,
];

export const CONTENT = Object.fromEntries(days.map((item) => [item.day, item]));
