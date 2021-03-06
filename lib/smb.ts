export class SameMessageBypass {
  private static CHARS = [
    "",
    // second space is intentionally `U+2800`
    " ⠀",
  ];
  private flag = 0;

  get() {
    const current = this.flag;
    this.flag = +!this.flag;
    return SameMessageBypass.CHARS[current];
  }
}
