$(document).ready(function() {
    var orderId;

    var settings = {
        "url": "/create/orderid",
        "method": "POST",
        "timeout": 0,
        "headers": {
            "Content-Type": "application/json"
        },
        "data": JSON.stringify({
            "amount": "100"
        }),
    };

    // Create order ID
    $.ajax(settings).done(function(response) {
        orderId = response.orderId;
        console.log(orderId);
        $("#rzp-button1").show();
    });

    // Handle button click
    $("#rzp-button1").click(function(e) {
        console.log("Click hua ji");

        var options = {
            "key": "rzp_test_l6p9RxLMZmHQRS",
            "amount": "19900",
            "currency": "INR",
            "name": "ShareLog Premium",
            "description": "ShareLog Premium Transaction",
            "image": "https://example.com/your_logo",
            "order_id": orderId,
            "handler": function(response) {
                alert(response.razorpay_payment_id);
                alert(response.razorpay_order_id);
                alert(response.razorpay_signature);

                var settings = {
                    "url": "/api/payment/verify",
                    "method": "POST",
                    "timeout": 0,
                    "headers": {
                        "Content-Type": "application/json"
                    },
                    "data": JSON.stringify({response}),
                };

                $.ajax(settings).done(function(response) {
                    alert(JSON.stringify(response));
                    console.log("2");
                });
            },
            "theme": {
                "color": "#3bda89"
            }
        };

        var rzp1 = new Razorpay(options);
        rzp1.open();
    });
});