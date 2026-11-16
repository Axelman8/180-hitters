package nl.axelman8.darts;

import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Native app menus share the web palette and return to their actual parent. */
final class TopBackDialog extends AlertDialog.Builder {
    private static final int BACKGROUND = Color.rgb(16,28,35);
    private static final int CARD = Color.rgb(32,49,59);
    private static final int LINE = Color.rgb(42,59,68);
    private static final int TEXT = Color.rgb(238,244,244);
    private static final int MUTED = Color.rgb(184,201,208);
    private static final int ACCENT = Color.rgb(200,245,106);
    private final Context context;
    private CharSequence title = "";
    private Runnable parent;
    TopBackDialog(Context context) { super(context,android.R.style.Theme_Material_Dialog_Alert); this.context=context; }
    TopBackDialog onBack(Runnable action) { parent=action; return this; }
    @Override public AlertDialog.Builder setTitle(CharSequence value) { title=value; return this; }
    private int dp(int value) { return Math.round(value*context.getResources().getDisplayMetrics().density); }
    private GradientDrawable shape(int color,int border) {
        GradientDrawable shape=new GradientDrawable();
        shape.setColor(color);shape.setCornerRadius(dp(12));shape.setStroke(dp(1),border);
        return shape;
    }
    private StateListDrawable buttonBackground(boolean primary) {
        StateListDrawable background=new StateListDrawable();
        background.addState(new int[]{android.R.attr.state_pressed},shape(primary?Color.rgb(217,255,146):Color.rgb(48,70,56),ACCENT));
        background.addState(new int[]{},shape(primary?ACCENT:CARD,primary?ACCENT:LINE));
        return background;
    }
    private void returnToParent() {
        if(parent!=null)parent.run();
        else if(context instanceof MainActivity)((MainActivity)context).returnToPreviousMenu();
    }
    @Override public AlertDialog.Builder setItems(CharSequence[] items,DialogInterface.OnClickListener listener) {
        return setAdapter(new ArrayAdapter<CharSequence>(getContext(),android.R.layout.simple_list_item_1,items) {
            @Override public View getView(int position,View recycled,ViewGroup container) {
                TextView row=(TextView)super.getView(position,recycled,container);
                row.setTextColor(TEXT);row.setTextSize(16);row.setMinHeight(dp(64));
                row.setPadding(dp(16),dp(14),dp(16),dp(14));row.setSingleLine(false);
                row.setBackground(buttonBackground(false));
                return row;
            }
        },listener);
    }
    @Override public AlertDialog show() {
        final AlertDialog dialog=create();
        LinearLayout header=new LinearLayout(context);header.setOrientation(LinearLayout.VERTICAL);
        header.setPadding(dp(22),dp(18),dp(22),0);header.setBackgroundColor(BACKGROUND);
        Button back=new Button(context);back.setText("TERUG");back.setAllCaps(false);
        back.setTextColor(TEXT);back.setTextSize(14);back.setMinHeight(dp(44));back.setBackground(buttonBackground(false));
        header.addView(back,new LinearLayout.LayoutParams(dp(108),dp(48)));
        TextView heading=new TextView(context);heading.setText(title);heading.setTextColor(TEXT);
        heading.setTextSize(24);heading.setTypeface(null,Typeface.BOLD);heading.setPadding(0,dp(20),0,dp(16));
        header.addView(heading);dialog.setCustomTitle(header);dialog.show();
        for(String name:new String[]{"parentPanel","topPanel","contentPanel","buttonPanel","customPanel"}) {
            int id=getContext().getResources().getIdentifier(name,"id","android");
            View panel=id==0?null:dialog.findViewById(id);if(panel!=null)panel.setBackgroundColor(BACKGROUND);
        }
        if(dialog.getWindow()!=null) {
            GradientDrawable surface=shape(BACKGROUND,LINE);surface.setCornerRadius(dp(22));
            dialog.getWindow().setBackgroundDrawable(surface);
            int width=Math.min(dp(760),context.getResources().getDisplayMetrics().widthPixels-dp(24));
            dialog.getWindow().setLayout(width,ViewGroup.LayoutParams.WRAP_CONTENT);
        }
        TextView message=dialog.findViewById(android.R.id.message);
        if(message!=null){message.setTextColor(MUTED);message.setTextSize(15);}
        if(dialog.getListView()!=null){dialog.getListView().setBackgroundColor(BACKGROUND);dialog.getListView().setDivider(null);dialog.getListView().setDividerHeight(dp(10));dialog.getListView().setPadding(dp(22),dp(4),dp(22),dp(16));}
        for(int which:new int[]{DialogInterface.BUTTON_POSITIVE,DialogInterface.BUTTON_NEGATIVE,DialogInterface.BUTTON_NEUTRAL}) {
            Button button=dialog.getButton(which);if(button==null)continue;
            boolean primary=which==DialogInterface.BUTTON_POSITIVE;
            button.setAllCaps(false);button.setTextSize(14);button.setMinHeight(dp(48));
            button.setTextColor(primary?Color.rgb(24,36,22):TEXT);button.setBackground(buttonBackground(primary));
            button.setPadding(dp(14),dp(10),dp(14),dp(10));
        }
        final Button cancel=dialog.getButton(DialogInterface.BUTTON_NEGATIVE);
        final boolean ordinaryCancel=cancel!=null&&("Annuleren".contentEquals(cancel.getText())||"Sluiten".contentEquals(cancel.getText()));
        if(ordinaryCancel)cancel.setVisibility(View.GONE);
        back.setOnClickListener(view->{if(ordinaryCancel)cancel.performClick();else dialog.dismiss();returnToParent();});
        dialog.setOnCancelListener(value->{if(ordinaryCancel)cancel.performClick();returnToParent();});
        return dialog;
    }
}
