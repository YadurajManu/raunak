import 'dart:async';
import 'package:flutter_cashfree_pg_sdk/utils/cfenums.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfpayment/cfwebcheckoutpayment.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfpaymentgateway/cfpaymentgatewayservice.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfsession/cfsession.dart';
import 'bookings_repository.dart';

abstract class PaymentGateway {
  Future<void> pay(OrderSnapshot order);
  void settled() {}
}

class CashfreePaymentGateway implements PaymentGateway {
  static bool _active = false;
  Completer<void>? _done;
  @override
  void settled() {
    final done = _done;
    if (done != null && !done.isCompleted) done.complete();
  }

  @override
  Future<void> pay(OrderSnapshot order) async {
    if (kIsWeb) {
      throw const BookingFailure(
        'Use the Android or iPhone app for native payment.',
      );
    }
    if (_active) {
      throw const BookingFailure(
        'A payment is already open. Return to it to continue.',
      );
    }
    if (order.status != 'PENDING' ||
        order.paymentSessionId == null ||
        order.cashfreeOrderId == null ||
        order.expiresAt.isBefore(DateTime.now())) {
      throw const BookingFailure(
        'This reservation needs a status check before payment.',
      );
    }
    _active = true;
    final done = Completer<void>();
    _done = done;
    try {
      final gateway = CFPaymentGatewayService();
      gateway.setCallback(
        (id) {
          if (!done.isCompleted) done.complete();
        },
        (error, id) {
          if (!done.isCompleted) {
            done.completeError(
              const BookingFailure(
                'Payment wasn’t completed. Check the booking status before retrying.',
              ),
            );
          }
        },
      );
      final session = CFSessionBuilder()
          .setEnvironment(
            order.cashfreeEnvironment == 'production'
                ? CFEnvironment.PRODUCTION
                : CFEnvironment.SANDBOX,
          )
          .setOrderId(order.cashfreeOrderId!)
          .setPaymentSessionId(order.paymentSessionId!)
          .build();
      final payment = CFWebCheckoutPaymentBuilder().setSession(session).build();
      gateway.doPayment(payment);
      await done.future.timeout(
        const Duration(minutes: 5),
        onTimeout: () => throw const BookingFailure(
          'Payment is still being checked. Open My tickets to check its status.',
        ),
      );
    } finally {
      _done = null;
      _active = false;
    }
  }
}
