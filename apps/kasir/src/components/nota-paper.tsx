// Pratinjau nota di layar: teks persis seperti hasil cetak (font mono), dengan QR di posisinya.
import { buildNota, renderText, type NotaData } from "@lk/shared";
import { StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { c, sp } from "./ui";

export function NotaPaper({ nota, columns }: { nota: NotaData; columns: number }) {
  const text = renderText(buildNota(nota, "pelanggan"), columns);
  const [before, after] = text.split(/\n? *\[QR\] *\n?/);
  return (
    <View style={st.paper} accessible accessibilityLabel={`Pratinjau nota ${nota.notaNumber}`}>
      <Text style={st.mono} allowFontScaling={false}>{before}</Text>
      {after !== undefined && nota.trackingUrl && (
        <View style={{ alignItems: "center", marginVertical: sp(2) }}>
          <QRCode value={nota.trackingUrl} size={160} color={c.text} backgroundColor={c.bg} />
        </View>
      )}
      {after !== undefined && <Text style={st.mono} allowFontScaling={false}>{after}</Text>}
    </View>
  );
}

const st = StyleSheet.create({
  paper: { alignSelf: "center", backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 4 },
  mono: { fontFamily: "monospace", fontSize: 11.5, lineHeight: 15, color: c.text },
});
