function tokenize(text: string, token: string): string[] {
  let ret = [];

  let tempText = "";

  for (let c of text) {
    if (c == token) {
      ret.push(tempText);
      tempText = "";
    } else {
      tempText += c;
    }
  }
  ret.push(tempText);
  return ret;
}

export {tokenize};
