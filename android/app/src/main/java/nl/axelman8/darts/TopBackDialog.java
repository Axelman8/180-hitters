package nl.axelman8.darts;

import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** App-owned Android menus use the same top return control as the web UI. */
final class TopBackDialog extends AlertDialog.Builder {
    private final Context context;
    private CharSequence title = "";
    TopBackDialog(Context context) { super(context); this.context = context; }
    @Override public AlertDialog.Builder setTitle(CharSequence value) { title = value; return this; }
    @Override public AlertDialog show() {
        final AlertDialog dialog = create();
        LinearLayout header = new LinearLayout(context);
        header.setOrientation(LinearLayout.VERTICAL);
        int padding = (int)(16 * context.getResources().getDisplayMetrics().density);
        header.setPadding(padding,padding,padding,0);
        Button back = new Button(context); back.setText("TERUG");
        header.addView(back,new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT,LinearLayout.LayoutParams.WRAP_CONTENT));
        TextView heading = new TextView(context); heading.setText(title); heading.setTextSize(20);
        heading.setPadding(0,padding,0,padding);header.addView(heading);
        dialog.setCustomTitle(header);dialog.show();
        final Button cancel = dialog.getButton(DialogInterface.BUTTON_NEGATIVE);
        boolean ordinaryCancel = cancel != null && ("Annuleren".contentEquals(cancel.getText()) || "Sluiten".contentEquals(cancel.getText()));
        if (ordinaryCancel) cancel.setVisibility(View.GONE);
        back.setOnClickListener(v -> { if (ordinaryCancel) cancel.performClick(); else dialog.cancel(); });
        return dialog;
    }
}
