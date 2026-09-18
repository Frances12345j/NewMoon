<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::rename('stock_outs', 'manual_stock_outs');
        Schema::rename('pull_outs', 'stock_outs');
    }

    public function down(): void
    {
        Schema::rename('stock_outs', 'pull_outs');
        Schema::rename('manual_stock_outs', 'stock_outs');
    }
};