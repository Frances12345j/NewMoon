<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_adjustments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('branch_id');
            $table->decimal('system_quantity', 12, 2)->default(0);
            $table->decimal('actual_quantity', 12, 2)->default(0);
            $table->decimal('difference', 12, 2)->default(0);
            $table->string('reason')->default('Inventory Count');
            $table->date('adjusted_at');
            $table->unsignedBigInteger('adjusted_by')->nullable();
            $table->timestamps();

            $table->index(['product_id', 'branch_id']);
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->foreign('branch_id')->references('id')->on('branches')->onDelete('cascade');
            $table->foreign('adjusted_by')->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_adjustments');
    }
};