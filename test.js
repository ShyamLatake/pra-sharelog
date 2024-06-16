// >. Get chart info from portfolio API and then retrieve using Data API. Store data in DB, and Then render graph on client side using JS.

// >. SS upload functionality from user and save with audio and text.

exchange_mappings = {
    "NSE_EQ": "equity",
    "NSE_FNO": "futures",
    "NSE_CURRENCY": "currency",
    "BSE_EQ": "equity",
    "BSE_FNO": "futures",
    "BSE_CURRENCY": "currency",
    "MCX_COMM": "commodity"
}

product_mappings = {
    "CNC": "equity",
    "INTRADAY": "equity",
    "MARGIN": "futures",
    "CO": "equity",
    "BO": "equity",
    "MTF": "equity"
}

//  Get the corresponding labels for exchange segment and product type
exchange_label = exchange_mappings.get(exchange_segment, "Unknown Exchange Segment")
product_label = product_mappings.get(product_type, "Unknown Product Type")

// # print the trade category
if product_label == "equity":
    print "equity"
elif product_label == "futures":
    print "futures"
elif product_label == "commodity":
    print "commodity"
else:
    print "options"